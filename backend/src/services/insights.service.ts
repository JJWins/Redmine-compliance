import prisma from '../config/database';
import aiService from './ai.service';

/**
 * Insights Service
 * Generates AI-powered insights from compliance data
 */
class InsightsService {
  /**
   * Generate comprehensive insights
   */
  async generateInsights(): Promise<{
    insights: string;
    cached: boolean;
    generatedAt: Date;
  }> {
    try {
      // Check if AI service is available
      if (!aiService.isAvailable()) {
        return {
          insights: 'AI insights are not available. Please configure Claude API key.',
          cached: false,
          generatedAt: new Date()
        };
      }

      // Gather compliance data
      const overview = await this.getComplianceOverview();
      const violationBreakdown = await this.getViolationBreakdown();
      const trends = await this.getTrends();
      const recentViolations = await this.getRecentViolations();
      const managerStats = await this.getManagerStats();

      // Generate insights using AI
      const insights = await aiService.generateInsights({
        totalViolations: overview.totalViolations,
        complianceRate: overview.complianceRate,
        violationBreakdown,
        trends,
        recentViolations,
        managerStats
      });

      return {
        insights,
        cached: false,
        generatedAt: new Date()
      };
    } catch (error: any) {
      console.error('Error generating insights:', error);
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateReport(period: 'week' | 'month' = 'week'): Promise<string> {
    try {
      if (!aiService.isAvailable()) {
        throw new Error('AI service not available');
      }

      const overview = await this.getComplianceOverview();
      const violationBreakdown = await this.getViolationBreakdown();
      const topViolators = await this.getTopViolators();
      const managerPerformance = await this.getManagerStats();

      const periodLabel = period === 'week' ? 'Last 7 days' : 'Last 30 days';

      const report = await aiService.generateReport({
        period: periodLabel,
        totalViolations: overview.totalViolations,
        complianceRate: overview.complianceRate,
        violationBreakdown,
        topViolators,
        managerPerformance,
        recommendations: []
      });

      return report;
    } catch (error: any) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  /**
   * Get compliance overview data
   */
  private async getComplianceOverview(): Promise<{
    totalViolations: number;
    complianceRate: number;
  }> {
    const totalViolations = await prisma.complianceViolation.count({
      where: { status: 'open' }
    });

    const totalUsers = await prisma.user.count({
      where: { status: 1 } // Only Active users
    });

    const usersWithViolations = await prisma.complianceViolation.findMany({
      where: { status: 'open' },
      select: { userId: true },
      distinct: ['userId']
    });

    const complianceRate = totalUsers > 0
      ? Math.round(((totalUsers - usersWithViolations.length) / totalUsers) * 100)
      : 100;

    return {
      totalViolations,
      complianceRate
    };
  }

  /**
   * Get violation breakdown by type
   */
  private async getViolationBreakdown(): Promise<Record<string, number>> {
    const violations = await prisma.complianceViolation.groupBy({
      by: ['violationType'],
      where: { status: 'open' },
      _count: true
    });

    const breakdown: Record<string, number> = {};
    violations.forEach(v => {
      breakdown[v.violationType] = v._count;
    });

    return breakdown;
  }

  /**
   * Get trends data
   */
  private async getTrends(): Promise<any> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentViolations = await prisma.complianceViolation.count({
      where: {
        status: 'open',
        createdAt: { gte: sevenDaysAgo }
      }
    });

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const previousViolations = await prisma.complianceViolation.count({
      where: {
        status: 'open',
        createdAt: {
          gte: fourteenDaysAgo,
          lt: sevenDaysAgo
        }
      }
    });

    const trend = previousViolations > 0
      ? ((recentViolations - previousViolations) / previousViolations) * 100
      : 0;

    return {
      recentViolations,
      previousViolations,
      trend: Math.round(trend * 10) / 10
    };
  }

  /**
   * Get recent violations
   */
  private async getRecentViolations(): Promise<any[]> {
    return await prisma.complianceViolation.findMany({
      where: { status: 'open' },
      take: 10,
      orderBy: { createdAt: 'desc' },
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
  }

  /**
   * Get manager statistics
   */
  private async getManagerStats(): Promise<any[]> {
    const projects = await prisma.project.findMany({
      where: {
        manager: { isNot: null }
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    const managerMap = new Map<string, any>();

    for (const project of projects) {
      if (!project.manager) continue;

      const managerId = project.manager.id;
      if (!managerMap.has(managerId)) {
        managerMap.set(managerId, {
          managerId,
          managerName: project.manager.name,
          projects: [],
          teamSize: 0,
          violations: 0
        });
      }

      const manager = managerMap.get(managerId)!;
      manager.projects.push(project.name);

      // Count violations for users in this project
      const projectUsers = await prisma.timeEntry.findMany({
        where: { projectId: project.id },
        select: { userId: true },
        distinct: ['userId']
      });

      const violations = await prisma.complianceViolation.count({
        where: {
          status: 'open',
          userId: { in: projectUsers.map(u => u.userId) }
        }
      });

      manager.violations += violations;
      manager.teamSize = new Set([
        ...manager.projects.flatMap(() => projectUsers.map(u => u.userId))
      ]).size;
    }

    return Array.from(managerMap.values());
  }

  /**
   * Get top violators
   */
  private async getTopViolators(): Promise<any[]> {
    const violations = await prisma.complianceViolation.groupBy({
      by: ['userId'],
      where: { status: 'open' },
      _count: true,
      orderBy: {
        _count: {
          userId: 'desc'
        }
      },
      take: 10
    });

    const violators = await Promise.all(
      violations.map(async (v) => {
        const user = await prisma.user.findUnique({
          where: { id: v.userId },
          select: {
            id: true,
            name: true,
            email: true
          }
        });

        return {
          user,
          violationCount: v._count
        };
      })
    );

    return violators.filter(v => v.user !== null);
  }
}

export default new InsightsService();

