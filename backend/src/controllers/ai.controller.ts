import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.utils';
import insightsService from '../services/insights.service';
import aiService from '../services/ai.service';
import configService from '../services/config.service';
import prisma from '../config/database';

/**
 * Check AI service status
 */
export const getStatus = async (req: Request, res: Response) => {
  try {
    const settings = await configService.getAISettings();
    const isAvailable = await aiService.isAvailable();
    const model = await aiService.getModel();
    
    return sendSuccess(res, {
      available: isAvailable,
      hasApiKey: !!settings.apiKey,
      apiKeyLength: settings.apiKey ? settings.apiKey.length : 0,
      model: model
    });
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get AI settings
 */
export const getAISettings = async (req: Request, res: Response) => {
  try {
    const settings = await configService.getAISettings();
    // Don't expose full API key, just show if it exists
    return sendSuccess(res, {
      ...settings,
      apiKey: settings.apiKey ? '***' + settings.apiKey.slice(-4) : ''
    });
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Update AI settings
 */
export const updateAISettings = async (req: Request, res: Response) => {
  try {
    const { model, apiKey, maxTokens, prompts } = req.body;
    
    await configService.updateAISettings({
      model,
      apiKey,
      maxTokens,
      prompts
    });

    // Reset AI service to reinitialize with new settings
    (aiService as any).initialized = false;
    (aiService as any).client = null;

    return sendSuccess(res, { message: 'AI settings updated successfully' });
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get AI-generated insights
 */
export const getInsights = async (req: Request, res: Response) => {
  try {
    if (!(await aiService.isAvailable())) {
      return sendError(res, 'AI service is not available. Please configure Claude API key.', 503);
    }

    const result = await insightsService.generateInsights();
    return sendSuccess(res, result);
  } catch (error: any) {
    console.error('Error getting insights:', error);
    return sendError(res, error.message || 'Failed to generate insights', 500);
  }
};

/**
 * Generate compliance report
 */
export const generateReport = async (req: Request, res: Response) => {
  try {
    const { period } = req.query; // 'week' or 'month'

    if (!(await aiService.isAvailable())) {
      return sendError(res, 'AI service is not available. Please configure Claude API key.', 503);
    }

    const reportPeriod = (period === 'month' ? 'month' : 'week') as 'week' | 'month';
    const report = await insightsService.generateReport(reportPeriod);

    return sendSuccess(res, {
      report,
      period: reportPeriod,
      generatedAt: new Date()
    });
  } catch (error: any) {
    console.error('Error generating report:', error);
    return sendError(res, error.message || 'Failed to generate report', 500);
  }
};

/**
 * Detect anomalies
 */
export const detectAnomalies = async (req: Request, res: Response) => {
  try {
    if (!(await aiService.isAvailable())) {
      return sendError(res, 'AI service is not available. Please configure Claude API key.', 503);
    }

    // Get time entry patterns
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        }
      },
      take: 100,
      orderBy: { createdAt: 'desc' }
    });

    // Group by user
    const userEntries = timeEntries.reduce((acc: any, entry) => {
      const userId = entry.userId;
      if (!acc[userId]) {
        acc[userId] = {
          user: entry.user.name,
          entries: [],
          totalHours: 0
        };
      }
      acc[userId].entries.push({
        hours: entry.hours,
        spentOn: entry.spentOn,
        createdAt: entry.createdOn
      });
      acc[userId].totalHours += parseFloat(entry.hours.toString());
      return acc;
    }, {});

    // Group by project
    const projectEntries = timeEntries.reduce((acc: any, entry) => {
      const projectId = entry.projectId || 'unknown';
      if (!acc[projectId]) {
        acc[projectId] = {
          project: entry.project?.name || 'Unknown',
          entries: [],
          totalHours: 0
        };
      }
      acc[projectId].entries.push({
        hours: entry.hours,
        spentOn: entry.spentOn
      });
      acc[projectId].totalHours += parseFloat(entry.hours.toString());
      return acc;
    }, {});

    // Time patterns
    const timePatterns = timeEntries.map(e => ({
      hours: parseFloat(e.hours.toString()),
      dayOfWeek: new Date(e.spentOn).getDay(),
      hourOfDay: new Date(e.createdOn).getHours()
    }));

    const anomalies = await aiService.detectAnomalies({
      userEntries: Object.values(userEntries),
      projectEntries: Object.values(projectEntries),
      timePatterns
    });

    return sendSuccess(res, {
      anomalies,
      analyzedEntries: timeEntries.length,
      generatedAt: new Date()
    });
  } catch (error: any) {
    console.error('Error detecting anomalies:', error);
    return sendError(res, error.message || 'Failed to detect anomalies', 500);
  }
};

/**
 * Assess risk levels
 */
export const assessRisk = async (req: Request, res: Response) => {
  try {
    if (!(await aiService.isAvailable())) {
      return sendError(res, 'AI service is not available. Please configure Claude API key.', 503);
    }

    const violations = await prisma.complianceViolation.findMany({
      where: { status: 'open' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      take: 50
    });

    // Get user compliance scores (only Active users - status 1)
    const users = await prisma.user.findMany({
      where: { status: 1 },
      take: 20
    });

    const userCompliance = await Promise.all(
      users.map(async (user) => {
        const userViolations = violations.filter(v => v.userId === user.id);
        const complianceScore = userViolations.length === 0 ? 100 : Math.max(0, 100 - (userViolations.length * 10));
        return {
          userId: user.id,
          userName: user.name,
          violations: userViolations.length,
          complianceScore
        };
      })
    );

    // Get project health
    const projects = await prisma.project.findMany({
      take: 20,
      include: {
        _count: {
          select: {
            issues: true
          }
        }
      }
    });

    const projectHealth = projects.map(project => ({
      projectId: project.id,
      projectName: project.name,
      issueCount: project._count.issues,
      status: project.status
    }));

    const riskAssessment = await aiService.assessRisk({
      violations,
      userCompliance,
      projectHealth
    });

    return sendSuccess(res, {
      riskAssessment,
      analyzedViolations: violations.length,
      analyzedUsers: users.length,
      analyzedProjects: projects.length,
      generatedAt: new Date()
    });
  } catch (error: any) {
    console.error('Error assessing risk:', error);
    return sendError(res, error.message || 'Failed to assess risk', 500);
  }
};

/**
 * Explain a specific violation
 */
export const explainViolation = async (req: Request, res: Response) => {
  try {
    const { violationId } = req.params;

    if (!(await aiService.isAvailable())) {
      return sendError(res, 'AI service is not available. Please configure Claude API key.', 503);
    }

    const violation = await prisma.complianceViolation.findUnique({
      where: { id: violationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!violation) {
      return sendError(res, 'Violation not found', 404);
    }

    // Get user history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userViolations = await prisma.complianceViolation.findMany({
      where: {
        userId: violation.userId,
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const userTimeEntries = await prisma.timeEntry.findMany({
      where: {
        userId: violation.userId,
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const explanation = await aiService.explainViolation(
      violation,
      {
        recentViolations: userViolations,
        recentTimeEntries: userTimeEntries
      },
      {
        violationDate: violation.date,
        detectedAt: violation.createdAt
      }
    );

    return sendSuccess(res, {
      explanation,
      violationId: violation.id,
      generatedAt: new Date()
    });
  } catch (error: any) {
    console.error('Error explaining violation:', error);
    return sendError(res, error.message || 'Failed to explain violation', 500);
  }
};

