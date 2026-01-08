import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.utils';
import prisma from '../config/database';
import configService from '../services/config.service';

export const getScorecard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const manager = await prisma.user.findUnique({
      where: { id },
      include: {
        teamMembers: true,
        managedProjects: {
          include: {
            issues: {
              include: {
                timeEntries: true
              }
            }
          }
        }
      }
    });

    if (!manager || manager.role !== 'manager') {
      return sendError(res, 'Manager not found', 404);
    }

    // Calculate scorecard metrics
    const teamSize = manager.teamMembers.length;
    const projectCount = manager.managedProjects.length;
    
    // Calculate compliance rate
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const teamMembersWithEntries = await prisma.timeEntry.findMany({
      where: {
        userId: { in: manager.teamMembers.map(m => m.id) },
        spentOn: { gte: sevenDaysAgo }
      },
      select: { userId: true },
      distinct: ['userId']
    });

    const complianceRate = teamSize > 0 
      ? Math.round((teamMembersWithEntries.length / teamSize) * 100)
      : 0;

    return sendSuccess(res, {
      managerId: id,
      managerName: manager.name,
      teamSize,
      projectCount,
      complianceRate,
      teamMembers: manager.teamMembers.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email
      }))
    });
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

export const getTeamCompliance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const manager = await prisma.user.findUnique({
      where: { id },
      include: {
        teamMembers: {
          include: {
            timeEntries: {
              where: {
                spentOn: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
              },
              orderBy: {
                spentOn: 'desc'
              },
              take: 1
            }
          }
        },
        managedProjects: {
          include: {
            issues: {
              include: {
                timeEntries: true
              }
            },
            _count: {
              select: {
                issues: true
              }
            }
          }
        }
      }
    });

    if (!manager || manager.role !== 'manager') {
      return sendError(res, 'Manager not found', 404);
    }

    // Calculate team compliance metrics
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const teamMembersWithEntries = await prisma.timeEntry.findMany({
      where: {
        userId: { in: manager.teamMembers.map(m => m.id) },
        spentOn: { gte: sevenDaysAgo }
      },
      select: { userId: true },
      distinct: ['userId']
    });

    const teamComplianceRate = manager.teamMembers.length > 0
      ? Math.round((teamMembersWithEntries.length / manager.teamMembers.length) * 100)
      : 0;

    const missingEntries = manager.teamMembers.length - teamMembersWithEntries.length;

    // Get tasks overrun
    const overrunThreshold = await configService.getOverrunThreshold();
    let tasksOverrun = 0;
    
    for (const project of manager.managedProjects) {
      for (const issue of project.issues) {
        if (issue.estimatedHours && issue.estimatedHours > 0) {
          const totalSpent = issue.timeEntries.reduce((sum, te) => sum + te.hours, 0);
          if (totalSpent > issue.estimatedHours * overrunThreshold) {
            tasksOverrun++;
          }
        }
      }
    }

    // Get total violations for team
    const totalViolations = await prisma.complianceViolation.count({
      where: {
        userId: { in: manager.teamMembers.map(m => m.id) },
        status: 'open'
      }
    });

    // Get issues without estimates
    let issuesWithoutEstimates = 0;
    for (const project of manager.managedProjects) {
      issuesWithoutEstimates += project.issues.filter(i => !i.estimatedHours || i.estimatedHours === 0).length;
    }

    // Format team members with last entry info
    const teamMembers = manager.teamMembers.map(member => ({
      id: member.id,
      name: member.name,
      email: member.email,
      hasRecentEntries: member.timeEntries.length > 0,
      lastTimeEntry: member.timeEntries[0]?.spentOn || null
    }));

    return sendSuccess(res, {
      managerId: id,
      managerName: manager.name,
      teamComplianceRate,
      missingEntries,
      tasksOverrun,
      totalViolations,
      issuesWithoutEstimates,
      teamMembers,
      managedProjects: manager.managedProjects.map(p => ({
        id: p.id,
        name: p.name,
        issuesWithoutEstimates: p.issues.filter(i => !i.estimatedHours || i.estimatedHours === 0).length,
        _count: {
          issues: p._count.issues
        }
      }))
    });
  } catch (error: any) {
    console.error('Error getting team compliance:', error);
    return sendError(res, error.message, 500);
  }
};

