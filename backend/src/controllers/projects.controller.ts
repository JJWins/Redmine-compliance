import { Request, Response } from 'express';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.utils';
import prisma from '../config/database';
import configService from '../services/config.service';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth.middleware';

// Helper function to build access filter based on user role
const buildAccessFilter = (req: AuthRequest, baseWhere: any = {}) => {
  const userId = req.userId;
  const userRole = req.userRole;

  // Admins can see everything - no additional filter
  if (userRole === 'admin') {
    return baseWhere;
  }

  // Managers can only see projects they manage
  if (userRole === 'manager' && userId) {
    return {
      ...baseWhere,
      managerId: userId,
    };
  }

  // Regular users - for now, they can see all projects
  // (You may want to restrict this further based on your requirements)
  return baseWhere;
};

// Helper function to map frontend column keys to Prisma orderBy
const getProjectOrderBy = (sortBy?: string, sortOrder: 'asc' | 'desc' = 'asc') => {
  if (!sortBy) return { name: 'asc' };
  
  switch (sortBy) {
    case 'name':
      return { name: sortOrder };
    case 'status':
      return { status: sortOrder };
    case 'manager.name':
      return { manager: { name: sortOrder } };
    case 'manager.email':
      return { manager: { email: sortOrder } };
    case '_count.issues':
    case '_count.timeEntries':
    case 'issuesWithoutEstimates':
      // These are calculated fields - will sort after fetching
      return { name: sortOrder };
    default:
      return { name: 'asc' };
  }
};

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;
    const filter = req.query.filter as string; // 'issuesWithoutEstimates'
    const sortBy = req.query.sortBy as string;
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc';

    const baseWhere: any = {};
    if (status) {
      baseWhere.status = status;
    }

    // Filter projects with issues without estimates
    if (filter === 'issuesWithoutEstimates') {
      baseWhere.issues = {
        some: {
          OR: [
            { estimatedHours: null },
            { estimatedHours: 0 },
          ],
        },
      };
    }

    // Apply role-based access control
    const where = buildAccessFilter(req, baseWhere);

    // Check if we need to sort by calculated fields
    const needsCalculatedSort = sortBy === '_count.issues' || sortBy === '_count.timeEntries' || sortBy === 'issuesWithoutEstimates';

    let projects: any[];
    let total: number;

    if (needsCalculatedSort) {
      // For calculated fields, we need to fetch ALL projects, sort, then paginate
      const allProjects = await prisma.project.findMany({
        where,
        include: {
          manager: {
            select: { id: true, name: true, email: true },
          },
          parent: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              issues: true,
              timeEntries: true,
            },
          },
          issues: {
            select: {
              id: true,
              estimatedHours: true,
            },
          },
        },
      });

      total = allProjects.length;

      // Add issues without estimates count
      let projectsWithDetails = allProjects.map(project => {
        const issuesWithoutEstimates = project.issues.filter(issue => 
          issue.estimatedHours === null || parseFloat(issue.estimatedHours.toString()) === 0
        ).length;
        
        return {
          ...project,
          issuesWithoutEstimates,
        };
      });

      // Sort by calculated fields
      projectsWithDetails.sort((a, b) => {
        if (sortBy === '_count.issues') {
          // Handle null values explicitly (though _count should always have a value)
          const aVal = a._count?.issues ?? 0;
          const bVal = b._count?.issues ?? 0;
          if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        } else if (sortBy === '_count.timeEntries') {
          const aVal = a._count?.timeEntries ?? 0;
          const bVal = b._count?.timeEntries ?? 0;
          if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        } else if (sortBy === 'issuesWithoutEstimates') {
          const aVal = a.issuesWithoutEstimates ?? 0;
          const bVal = b.issuesWithoutEstimates ?? 0;
          if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        }
        return 0;
      });

      // Apply pagination after sorting
      projects = projectsWithDetails.slice(skip, skip + limit);
    } else {
      // For non-calculated fields, use Prisma's built-in sorting and pagination
      [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          skip,
          take: limit,
          include: {
            manager: {
              select: { id: true, name: true, email: true },
            },
            parent: {
              select: { id: true, name: true },
            },
            _count: {
              select: {
                issues: true,
                timeEntries: true,
              },
            },
            issues: {
              select: {
                id: true,
                estimatedHours: true,
              },
            },
          },
          orderBy: getProjectOrderBy(sortBy, sortOrder),
        }),
        prisma.project.count({ where }),
      ]);

      // Add issues without estimates count
      projects = projects.map(project => {
        const issuesWithoutEstimates = project.issues.filter(issue => 
          issue.estimatedHours === null || parseFloat(issue.estimatedHours.toString()) === 0
        ).length;
        
        return {
          ...project,
          issuesWithoutEstimates,
        };
      });
    }

    return sendPaginated(res, projects, page, limit, total);
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

export const getProjectDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;
    
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
        parent: {
          select: { id: true, name: true },
        },
        children: {
          select: { id: true, name: true, status: true },
        },
        issues: {
          include: {
            assignedTo: {
              select: { id: true, name: true },
            },
            timeEntries: {
              select: { hours: true },
            },
          },
        },
        _count: {
          select: {
            issues: true,
            timeEntries: true,
          },
        },
      },
    });

    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    // Check access: Managers can only see projects they manage
    if (userRole === 'manager' && userId && project.managerId !== userId) {
      return sendError(res, 'Access denied. You can only view projects you manage.', 403);
    }

    return sendSuccess(res, project);
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Update project manager
 */
export const updateProjectManager = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body; // Can be null to remove manager

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    // Verify manager exists if provided
    if (managerId) {
      const manager = await prisma.user.findUnique({
        where: { id: managerId },
      });

      if (!manager) {
        return sendError(res, 'Manager (user) not found', 404);
      }
    }

    // Update project manager
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        managerId: managerId || null,
      },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return sendSuccess(res, updatedProject);
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

export const getProjectOverruns = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;
    
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        issues: {
          where: {
            estimatedHours: { not: null },
          },
          include: {
            timeEntries: {
              select: { hours: true },
            },
            assignedTo: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    // Check access: Managers can only see projects they manage
    if (userRole === 'manager' && userId && project.managerId !== userId) {
      return sendError(res, 'Access denied. You can only view projects you manage.', 403);
    }

    const overrunThreshold = await configService.getOverrunThreshold();

    const overruns = project.issues
      .map(issue => {
        const estimated = parseFloat(issue.estimatedHours?.toString() || '0');
        const totalSpent = issue.timeEntries.reduce(
          (sum, te) => sum + parseFloat(te.hours.toString()),
          0
        );

        if (estimated > 0 && totalSpent > estimated * overrunThreshold) {
          return {
            issueId: issue.id,
            issueSubject: issue.subject,
            estimatedHours: estimated,
            spentHours: totalSpent,
            overrunPercentage: Math.round(((totalSpent - estimated) / estimated) * 100),
            assignedTo: issue.assignedTo,
          };
        }
        return null;
      })
      .filter(Boolean);

    return sendSuccess(res, overruns);
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

/**
 * Get projects with stale tasks (open tasks running for more than configured months)
 * 
 * Logic: A task is considered "stale" if:
 * - Status is 'open' (not closed/resolved)
 * - Created more than X months ago (using createdAt field)
 * 
 * Alternative approaches we could use:
 * - updatedAt: Check if task hasn't been updated in X months
 * - Time entries: Check if no time entries logged in X months
 * 
 * Currently using createdAt as it represents when the task started "running"
 */
export const getProjectsWithStaleTasks = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    
    const rules = await configService.getComplianceRules();
    const staleMonths = rules.staleTaskMonths || 2;
    
    // Calculate the cutoff date: tasks created before this date are considered stale
    const staleDate = new Date();
    staleDate.setMonth(staleDate.getMonth() - staleMonths);
    
    logger.info('Finding stale tasks', { staleDate: staleDate.toISOString(), staleMonths });

    // Build base filter for stale tasks
    const baseWhere = {
      issues: {
        some: {
          // Task must be open (not closed/resolved/rejected)
          // Using NOT IN to exclude closed states (case-insensitive check via Prisma)
          status: {
            notIn: ['Closed', 'Resolved', 'Rejected', 'closed', 'resolved', 'rejected'],
          },
          // Task was created more than X months ago (using createdAt field)
          createdAt: {
            lt: staleDate,
          },
        },
      },
    };

    // Apply role-based access control
    const where = buildAccessFilter(req, baseWhere);

    // First get total count of projects with stale tasks
    const total = await prisma.project.count({ where });

    logger.info('Found projects with stale tasks', { total });

    // Find projects with stale tasks - filter in where clause
    const projects = await prisma.project.findMany({
      where,
      skip,
      take: limit,
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
        issues: {
          where: {
            status: {
              notIn: ['Closed', 'Resolved', 'Rejected', 'closed', 'resolved', 'rejected'],
            },
            createdAt: {
              lt: staleDate,
            },
          },
          select: {
            id: true,
            subject: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'asc', // Oldest first
          },
        },
        _count: {
          select: {
            issues: true,
            timeEntries: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Map projects with stale task counts and additional info
    const projectsWithStaleTasks = projects.map(project => {
      const staleIssues = project.issues;
      const oldestStaleTask = staleIssues.length > 0 
        ? new Date(Math.min(...staleIssues.map(i => new Date(i.createdAt).getTime())))
        : null;
      
      // Calculate how many months old the oldest stale task is
      const monthsOld = oldestStaleTask 
        ? Math.round((new Date().getTime() - oldestStaleTask.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 0;

      return {
        ...project,
        staleTasksCount: staleIssues.length,
        oldestStaleTask: oldestStaleTask,
        oldestStaleTaskMonths: monthsOld,
      };
    });

    logger.info('Returning projects with stale tasks', { count: projectsWithStaleTasks.length });

    return sendPaginated(res, projectsWithStaleTasks, page, limit, total);
  } catch (error: any) {
    logger.error('Error in getProjectsWithStaleTasks', { error: error.message, stack: error.stack });
    return sendError(res, error.message, 500);
  }
};

/**
 * Get projects with tasks that have spent more than configured hours
 * 
 * IMPORTANT: This calculates total spent hours from ALL time entries linked to each issue,
 * from the date of issue creation onwards. There is NO date filter - it includes ALL
 * historical time entries for each issue, regardless of when they were logged.
 * This gives the complete effort from issue creation, not just recent entries.
 */
export const getProjectsWithHighSpentHours = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    
    const rules = await configService.getComplianceRules();
    const maxSpentHours = rules.maxSpentHours || 350;

    // Build access filter
    const where = buildAccessFilter(req);

    // Get all projects with their issues and time entries to calculate totals
    const allProjects = await prisma.project.findMany({
      where,
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
        issues: {
          select: {
            id: true,
            subject: true,
            estimatedHours: true,
            timeEntries: {
              select: { hours: true },
            },
          },
        },
        _count: {
          select: {
            issues: true,
            timeEntries: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Filter projects that have issues with high spent hours
    // Calculate total spent hours from ALL time entries (from issue creation date onwards)
    const projectsWithHighSpent = allProjects
      .map(project => {
        const highSpentIssues = project.issues.filter(issue => {
          // Sum ALL time entries for this issue (no date filter - includes all historical entries)
          const totalSpent = issue.timeEntries.reduce(
            (sum, te) => sum + parseFloat(te.hours.toString()),
            0
          );
          return totalSpent > maxSpentHours;
        });

        if (highSpentIssues.length > 0) {
          return {
            ...project,
            highSpentIssuesCount: highSpentIssues.length,
            maxSpentHours: Math.max(...highSpentIssues.map(issue => 
              issue.timeEntries.reduce((sum, te) => sum + parseFloat(te.hours.toString()), 0)
            )),
          };
        }
        return null;
      })
      .filter(Boolean);

    const total = projectsWithHighSpent.length;
    
    // Apply pagination
    const paginatedProjects = projectsWithHighSpent.slice(skip, skip + limit);

    return sendPaginated(res, paginatedProjects, page, limit, total);
  } catch (error: any) {
    logger.error('Error in getProjectsWithHighSpentHours', { error: error.message, stack: error.stack });
    return sendError(res, error.message, 500);
  }
};
