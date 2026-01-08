import { Request, Response } from 'express';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.utils';
import prisma from '../config/database';
import configService from '../services/config.service';
import { AuthRequest } from '../middleware/auth.middleware';

// Helper function to get project IDs that a manager has access to
const getManagerProjectIds = async (userId: string): Promise<string[]> => {
  const projects = await prisma.project.findMany({
    where: { managerId: userId },
    select: { id: true },
  });
  return projects.map(p => p.id);
};

// Helper function to build access filter for issues based on user role
const buildIssueAccessFilter = async (req: AuthRequest, baseWhere: any = {}) => {
  const userId = req.userId;
  const userRole = req.userRole;

  // Admins can see everything - no additional filter
  if (userRole === 'admin') {
    return baseWhere;
  }

  // Managers can only see issues from projects they manage
  if (userRole === 'manager' && userId) {
    const projectIds = await getManagerProjectIds(userId);
    if (projectIds.length === 0) {
      // Manager has no projects, return filter that matches nothing
      // Use a non-existent UUID to ensure no matches
      return {
        ...baseWhere,
        projectId: '00000000-0000-0000-0000-000000000000', // This will match nothing
      };
    }
    return {
      ...baseWhere,
      projectId: {
        in: projectIds,
      },
    };
  }

  // Regular users - for now, they can see all issues
  // (You may want to restrict this further based on your requirements)
  return baseWhere;
};

// Helper function to map frontend column keys to Prisma orderBy
const getIssueOrderBy = (sortBy?: string, sortOrder: 'asc' | 'desc' = 'asc') => {
  if (!sortBy) return { redmineIssueId: 'desc' };
  
  switch (sortBy) {
    case 'redmineIssueId':
      return { redmineIssueId: sortOrder };
    case 'subject':
      return { subject: sortOrder };
    case 'status':
      return { status: sortOrder };
    case 'estimatedHours':
      return { estimatedHours: sortOrder };
    case 'project.name':
      return { project: { name: sortOrder } };
    case 'project.manager.name':
      return { project: { manager: { name: sortOrder } } };
    case 'assignedTo.name':
      return { assignedTo: { name: sortOrder } };
    case 'totalSpentHours':
    case 'overrun':
      // These are calculated fields - will sort after fetching
      return { redmineIssueId: sortOrder };
    default:
      return { redmineIssueId: 'desc' };
  }
};

export const getIssues = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const projectId = req.query.projectId as string;
    const filter = req.query.filter as string; // 'withoutEstimates' or 'overrun'
    const sortBy = req.query.sortBy as string;
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc';

    const baseWhere: any = {};

    if (projectId) {
      // If manager is requesting a specific project, verify access first
      if (req.userRole === 'manager' && req.userId) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { managerId: true },
        });
        if (!project || project.managerId !== req.userId) {
          return sendError(res, 'Access denied. You can only view issues from projects you manage.', 403);
        }
      }
      baseWhere.projectId = projectId;
    }

    // Get overrun threshold from config (needed for overrun filter)
    const overrunThreshold = await configService.getOverrunThreshold();

    if (filter === 'withoutEstimates') {
      baseWhere.OR = [
        { estimatedHours: null },
        { estimatedHours: 0 },
      ];
    } else if (filter === 'overrun') {
      // For overrun filter, we need to fetch ALL issues with estimates > 0 first,
      // then filter for overrun, then paginate
      baseWhere.estimatedHours = {
        not: null,
        gt: 0,
      };
    }

    // Apply role-based access control
    const where = await buildIssueAccessFilter(req, baseWhere);

    // For overrun filter, we need to fetch all issues first, filter, then paginate
    if (filter === 'overrun') {
      // Fetch ALL issues with estimates (no pagination yet)
      const allIssuesWithEstimates = await prisma.issue.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              manager: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          timeEntries: {
            select: {
              hours: true,
            },
          },
        },
      });

      // Calculate spent hours and filter for overrun issues
      const allOverrunIssues = allIssuesWithEstimates
        .map(issue => {
          const totalSpent = issue.timeEntries.reduce(
            (sum, te) => sum + parseFloat(te.hours.toString()),
            0
          );
          const estimated = parseFloat(issue.estimatedHours?.toString() || '0');
          const overrun = estimated > 0 && totalSpent > estimated * overrunThreshold;

          return {
            ...issue,
            totalSpentHours: totalSpent,
            estimatedHours: estimated,
            overrun,
          };
        })
        .filter(issue => issue.overrun === true);
      
      // Apply sorting
      if (sortBy && sortBy !== 'totalSpentHours' && sortBy !== 'overrun') {
        // For non-calculated fields, we can sort before pagination
        allOverrunIssues.sort((a, b) => {
          if (sortBy === 'redmineIssueId') {
            return sortOrder === 'asc' ? a.redmineIssueId - b.redmineIssueId : b.redmineIssueId - a.redmineIssueId;
          } else if (sortBy === 'subject') {
            // Handle null/undefined subject
            if (!a.subject && !b.subject) return 0;
            if (!a.subject) return sortOrder === 'asc' ? 1 : -1;
            if (!b.subject) return sortOrder === 'asc' ? -1 : 1;
            return sortOrder === 'asc' ? a.subject.localeCompare(b.subject) : b.subject.localeCompare(a.subject);
          } else if (sortBy === 'status') {
            // Handle null/undefined status
            if (!a.status && !b.status) return 0;
            if (!a.status) return sortOrder === 'asc' ? 1 : -1;
            if (!b.status) return sortOrder === 'asc' ? -1 : 1;
            return sortOrder === 'asc' ? a.status.localeCompare(b.status) : b.status.localeCompare(a.status);
          } else if (sortBy === 'estimatedHours') {
            // Handle null estimatedHours
            if (a.estimatedHours == null && b.estimatedHours == null) return 0;
            if (a.estimatedHours == null) return sortOrder === 'asc' ? 1 : -1;
            if (b.estimatedHours == null) return sortOrder === 'asc' ? -1 : 1;
            return sortOrder === 'asc' ? a.estimatedHours - b.estimatedHours : b.estimatedHours - a.estimatedHours;
          }
          return 0;
        });
      } else {
        // Default sort by redmineIssueId desc
        allOverrunIssues.sort((a, b) => b.redmineIssueId - a.redmineIssueId);
      }

      // Sort by calculated fields if needed (after fetching)
      if (sortBy === 'totalSpentHours' || sortBy === 'overrun') {
        allOverrunIssues.sort((a, b) => {
          // Handle null values explicitly
          if (sortBy === 'totalSpentHours') {
            // totalSpentHours should never be null in this context, but handle it explicitly
            const aVal = a.totalSpentHours ?? 0;
            const bVal = b.totalSpentHours ?? 0;
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
          } else if (sortBy === 'overrun') {
            // overrun is boolean, no null handling needed
            const aVal = a.overrun ? 1 : 0;
            const bVal = b.overrun ? 1 : 0;
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
          }
          return 0;
        });
      }
      
      // Now apply pagination to the filtered overrun issues
      const totalOverrunCount = allOverrunIssues.length;
      const paginatedOverrunIssues = allOverrunIssues.slice(skip, skip + limit);

      return sendPaginated(res, paginatedOverrunIssues, page, limit, totalOverrunCount);
    }

    // Check if we need to sort by calculated fields
    const needsCalculatedSort = sortBy === 'totalSpentHours' || sortBy === 'overrun';

    let issues: any[];
    let total: number;

    if (needsCalculatedSort) {
      // For calculated fields, we need to fetch ALL issues, sort, then paginate
      const allIssues = await prisma.issue.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              manager: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          timeEntries: {
            select: {
              hours: true,
            },
          },
        },
      });

      total = allIssues.length;

      // Calculate spent hours for each issue
      let issuesWithDetails = allIssues.map(issue => {
        const totalSpent = issue.timeEntries.reduce(
          (sum, te) => sum + parseFloat(te.hours.toString()),
          0
        );
        const estimated = issue.estimatedHours ? parseFloat(issue.estimatedHours.toString()) : 0;
        const overrun = estimated > 0 && totalSpent > estimated * overrunThreshold;

        return {
          ...issue,
          totalSpentHours: totalSpent,
          estimatedHours: estimated,
          overrun,
        };
      });

      // Sort by calculated fields
      issuesWithDetails.sort((a, b) => {
        if (sortBy === 'totalSpentHours') {
          // Handle null values explicitly (though totalSpentHours should always have a value)
          const aVal = a.totalSpentHours ?? 0;
          const bVal = b.totalSpentHours ?? 0;
          if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        } else if (sortBy === 'overrun') {
          // overrun is boolean, no null handling needed
          const aVal = a.overrun ? 1 : 0;
          const bVal = b.overrun ? 1 : 0;
          if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        }
        return 0;
      });

      // Apply pagination after sorting
      issues = issuesWithDetails.slice(skip, skip + limit);
    } else {
      // For non-calculated fields, use Prisma's built-in sorting and pagination
      [issues, total] = await Promise.all([
        prisma.issue.findMany({
          where,
          skip,
          take: limit,
          include: {
            project: {
              select: {
                id: true,
                name: true,
                manager: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            timeEntries: {
              select: {
                hours: true,
              },
            },
          },
          orderBy: getIssueOrderBy(sortBy, sortOrder),
        }),
        prisma.issue.count({ where }),
      ]);

      // Calculate spent hours for each issue
      issues = issues.map(issue => {
        const totalSpent = issue.timeEntries.reduce(
          (sum, te) => sum + parseFloat(te.hours.toString()),
          0
        );
        const estimated = issue.estimatedHours ? parseFloat(issue.estimatedHours.toString()) : 0;
        const overrun = estimated > 0 && totalSpent > estimated * overrunThreshold;

        return {
          ...issue,
          totalSpentHours: totalSpent,
          estimatedHours: estimated,
          overrun,
        };
      });
    }

    return sendPaginated(res, issues, page, limit, total);
  } catch (error: any) {
    console.error('Error getting issues:', error);
    return sendError(res, error.message, 500);
  }
};

export const getIssueDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            manager: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        timeEntries: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { spentOn: 'desc' },
        },
      },
    });

    if (!issue) {
      return sendError(res, 'Issue not found', 404);
    }

    // Check access: Managers can only see issues from projects they manage
    if (userRole === 'manager' && userId) {
      const project = await prisma.project.findUnique({
        where: { id: issue.projectId },
        select: { managerId: true },
      });
      if (!project || project.managerId !== userId) {
        return sendError(res, 'Access denied. You can only view issues from projects you manage.', 403);
      }
    }

    // Get overrun threshold from config
    const overrunThreshold = await configService.getOverrunThreshold();

    // Calculate total spent hours
    const totalSpent = issue.timeEntries.reduce(
      (sum, te) => sum + parseFloat(te.hours.toString()),
      0
    );
    const estimated = issue.estimatedHours ? parseFloat(issue.estimatedHours.toString()) : 0;

    return sendSuccess(res, {
      ...issue,
      totalSpentHours: totalSpent,
      estimatedHours: estimated,
      overrun: estimated > 0 && totalSpent > estimated * overrunThreshold,
    });
  } catch (error: any) {
    console.error('Error getting issue details:', error);
    return sendError(res, error.message, 500);
  }
};

