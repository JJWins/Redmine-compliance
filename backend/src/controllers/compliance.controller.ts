import { Request, Response } from 'express';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.utils';
import prisma from '../config/database';
import complianceService from '../services/compliance.service';
import configService from '../services/config.service';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth.middleware';

export const getOverview = async (_req: Request, res: Response) => {
  try {
    // Get total users - only count users with status 1 (Active)
    const totalUsers = await prisma.user.count({
      where: { status: 1 },
    });

    // Get compliance rules to use configurable missingEntryDays
    const complianceRules = await configService.getComplianceRules();
    const missingEntryDays = complianceRules.missingEntryDays || 7; // Default: 7 days
    
    // Calculate missing entries based on CURRENT configuration (not hardcoded 7 days)
    // This ensures the dashboard reflects the current config value
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - missingEntryDays);
    cutoffDate.setHours(0, 0, 0, 0);
    
    logger.info('Calculating missing entries', {
      missingEntryDays,
      cutoffDate: cutoffDate.toISOString(),
      currentDate: new Date().toISOString()
    });
    
    const usersWithEntries = await prisma.timeEntry.findMany({
      where: {
        spentOn: { gte: cutoffDate },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const usersWithEntriesIds = usersWithEntries.map(e => e.userId);
    const missingEntries = totalUsers - usersWithEntriesIds.length;
    
    logger.info('Missing entries calculated', {
      missingEntryDays,
      totalUsers,
      usersWithEntries: usersWithEntriesIds.length,
      missingEntries
    });

    // Get tasks overrun (issues where spent > estimated * threshold)
    // Get threshold from config
    const overrunThreshold = await configService.getOverrunThreshold();
    
    // Logic: An issue is considered "overrun" if:
    // 1. It has an estimatedHours value (not null, not 0)
    // 2. Total spent hours (sum of all time entries linked to this issue) > estimated * threshold
    
    const issuesWithEstimates = await prisma.issue.findMany({
      where: {
        estimatedHours: { 
          not: null,
          gt: 0, // Also exclude zero estimates
        },
      },
      include: {
        timeEntries: {
          select: { 
            hours: true,
            issueId: true, // Include to verify linkage
          },
        },
      },
    });

    const overrunPercentage = await configService.getOverrunPercentage();
    logger.info('Task Overrun Check', {
      threshold: overrunThreshold,
      thresholdPercent: overrunPercentage,
      issuesWithEstimates: issuesWithEstimates.length
    });

    let tasksOverrun = 0;
    let issuesWithTimeEntries = 0;
    let totalIssuesWithEstimates = issuesWithEstimates.length;
    let sampleIssues: any[] = [];
    
    for (const issue of issuesWithEstimates) {
      const estimated = parseFloat(issue.estimatedHours?.toString() || '0');
      const totalSpent = issue.timeEntries.reduce((sum, te) => sum + parseFloat(te.hours.toString()), 0);
      
      if (issue.timeEntries.length > 0) {
        issuesWithTimeEntries++;
        
        // Collect sample issues for debugging
        if (sampleIssues.length < 5) {
          sampleIssues.push({
            issueId: issue.redmineIssueId,
            estimated,
            totalSpent,
            timeEntriesCount: issue.timeEntries.length,
            threshold: overrunThreshold,
            thresholdValue: estimated * overrunThreshold,
            isOverrun: totalSpent > estimated * overrunThreshold,
            ratio: estimated > 0 ? (totalSpent / estimated).toFixed(2) : 'N/A'
          });
        }
      }
      
      // Overrun condition: spent > estimated * threshold
      if (estimated > 0 && totalSpent > estimated * overrunThreshold) {
        tasksOverrun++;
        logger.warn('Task overrun detected', {
          issueId: issue.redmineIssueId,
          estimated,
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          threshold: estimated * overrunThreshold,
          percentage: Math.round((totalSpent / estimated) * 100)
        });
      }
    }

    logger.info('Task Overrun Summary', {
      threshold: overrunThreshold,
      thresholdPercent: overrunPercentage,
      totalIssuesWithEstimates,
      issuesWithTimeEntries,
      tasksOverrun,
      sampleIssues: sampleIssues.length > 0 ? sampleIssues : undefined
    });
    
    // Also check if time entries exist in the system
    const totalTimeEntriesCount = await prisma.timeEntry.count();
    const timeEntriesWithIssues = await prisma.timeEntry.count({
      where: {
        issueId: { not: null },
      },
    });
    
    // Get sample time entries linked to issues for debugging
    const sampleTimeEntries = await prisma.timeEntry.findMany({
      where: {
        issueId: { not: null },
      },
      take: 5,
      include: {
        issue: {
          select: {
            redmineIssueId: true,
            estimatedHours: true,
          },
        },
      },
    });
    
    // Also check: Are there issues with estimates that have NO time entries?
    const issuesWithEstimatesNoEntries = await prisma.issue.count({
      where: {
        estimatedHours: { not: null, gt: 0 },
        timeEntries: {
          none: {},
        },
      },
    });
    
    logger.info('Time Entries Analysis', {
      totalTimeEntriesCount,
      timeEntriesWithIssues,
      issuesWithEstimatesNoEntries,
      sampleTimeEntries: sampleTimeEntries.length > 0 ? sampleTimeEntries.map(te => ({
        timeEntryId: te.redmineTimeEntryId,
        issueId: te.issue?.redmineIssueId,
        hours: te.hours,
        issueEst: te.issue?.estimatedHours ? parseFloat(te.issue.estimatedHours.toString()) : 0
      })) : undefined
    });

    // Get managers flagged (managers with team members having violations)
    const managersWithViolations = await prisma.user.findMany({
      where: {
        role: 'manager',
        teamMembers: {
          some: {
            violations: {
              some: {
                status: 'open',
              },
            },
          },
        },
      },
    });

    // Calculate compliance rate (users with entries in last 7 days / total users)
    const complianceRate = totalUsers > 0 
      ? Math.round((usersWithEntriesIds.length / totalUsers) * 100) 
      : 0;

    // Get additional statistics
    const totalProjects = await prisma.project.count({
      where: { status: 'active' },
    });

    const totalIssues = await prisma.issue.count();

    const totalTimeEntries = await prisma.timeEntry.count();

    const totalViolations = await prisma.complianceViolation.count({
      where: { status: 'open' },
    });

    // Calculate stale task violations based on CURRENT configuration (not just count existing violations)
    // This ensures the dashboard reflects the current config value
    // Logic: Match the compliance service - get open issues, include time entries in the window, count those with zero entries
    // Note: complianceRules was already loaded above for missingEntryDays
    const staleTaskDays = complianceRules.staleTaskDays || 14; // Match default in config service
    const staleTaskCutoffDate = new Date();
    staleTaskCutoffDate.setDate(staleTaskCutoffDate.getDate() - staleTaskDays);
    // Set time to start of day to ensure consistent date comparison
    staleTaskCutoffDate.setHours(0, 0, 0, 0);
    
    // Format staleTaskCutoffDate as date string for comparison (spentOn is stored as Date without time)
    const staleTaskCutoffDateStr = staleTaskCutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    logger.info('Calculating stale task violations', {
      staleTaskDays,
      cutoffDate: staleTaskCutoffDateStr,
      cutoffDateISO: staleTaskCutoffDate.toISOString(),
      currentDate: new Date().toISOString()
    });
    
    // Get all open issues with their time entries in the configured window
    // This matches the logic in compliance.service.ts detectStaleTasks()
    // Note: spentOn is stored as Date (no time), so we compare with the date
    const openIssues = await prisma.issue.findMany({
      where: {
        status: {
          notIn: ['Closed', 'Resolved', 'Rejected', 'closed', 'resolved', 'rejected'],
        },
        assignedToId: { not: null }, // Must be assigned
      },
      include: {
        timeEntries: {
          where: {
            spentOn: { gte: staleTaskCutoffDate }, // Only include time entries in the configured time window
          },
        },
      },
    });
    
    // Count issues that have NO time entries in the configured time window
    const staleTaskViolations = openIssues.filter(issue => issue.timeEntries.length === 0).length;
    
    // Also get sample data for debugging
    const sampleStaleIssues = openIssues
      .filter(issue => issue.timeEntries.length === 0)
      .slice(0, 5)
      .map(issue => ({
        issueId: issue.redmineIssueId,
        subject: issue.subject,
        status: issue.status,
        assignedToId: issue.assignedToId
      }));
    
    logger.info('Stale task violations calculated', {
      staleTaskDays,
      cutoffDate: staleTaskCutoffDateStr,
      totalOpenIssues: openIssues.length,
      staleTaskViolations,
      sampleStaleIssues
    });

    // Get issues with null or zero estimates
    const issuesWithoutEstimates = await prisma.issue.count({
      where: {
        OR: [
          { estimatedHours: null },
          { estimatedHours: 0 },
        ],
      },
    });

    // Get projects with issues that have null/zero estimates
    const projectsWithIssuesWithoutEstimates = await prisma.project.findMany({
      where: {
        status: 'active',
        issues: {
          some: {
            OR: [
              { estimatedHours: null },
              { estimatedHours: 0 },
            ],
          },
        },
      },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            issues: {
              where: {
                OR: [
                  { estimatedHours: null },
                  { estimatedHours: 0 },
                ],
              },
            },
          },
        },
      },
    });

    // Flag PMs whose projects have issues without estimates
    const flaggedPMs = projectsWithIssuesWithoutEstimates
      .filter(p => p.manager)
      .map(p => p.manager!.id);
    const uniqueFlaggedPMs = [...new Set(flaggedPMs)];

    // Calculate late entry violations based on CURRENT configuration (not just count existing violations)
    // This ensures the dashboard reflects the current config value
    // Logic: Match the compliance service - check time entries created in the check window, count those exceeding threshold
    const lateEntryCheckDays = complianceRules.lateEntryCheckDays || 30; // Default: 30 days
    const lateEntryDays = complianceRules.lateEntryDays || 3; // Default: 3 days threshold
    
    const checkDate = new Date();
    const checkWindowStart = new Date(checkDate);
    checkWindowStart.setDate(checkWindowStart.getDate() - lateEntryCheckDays);
    checkWindowStart.setHours(0, 0, 0, 0);
    
    logger.info('Calculating late entry violations', {
      lateEntryCheckDays,
      lateEntryDays,
      checkWindowStart: checkWindowStart.toISOString(),
      checkDate: checkDate.toISOString()
    });
    
    // Get time entries created in the configured check window
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        createdOn: { gte: checkWindowStart },
      },
    });
    
    // Count entries that exceed the configured threshold
    let lateEntryViolations = 0;
    for (const entry of timeEntries) {
      const daysLate = Math.floor(
        (entry.createdOn.getTime() - entry.spentOn.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Use configurable threshold
      if (daysLate > lateEntryDays) {
        lateEntryViolations++;
      }
    }
    
    logger.info('Late entry violations calculated', {
      lateEntryCheckDays,
      lateEntryDays,
      totalTimeEntriesChecked: timeEntries.length,
      lateEntryViolations
    });

    // Calculate partial entries (weekly totals < 40 hours for 5 working days)
    // Group by user, project/issue, and week (Monday to Friday)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);
    
    // Get active user IDs first
    const activeUsers = await prisma.user.findMany({
      where: { status: 1 },
      select: { id: true },
    });
    const activeUserIds = activeUsers.map(u => u.id);
    
    // Get all time entries in the last week
    const partialTimeEntries = await prisma.timeEntry.findMany({
      where: {
        spentOn: { gte: oneWeekAgo },
        userId: { in: activeUserIds },
      },
      select: {
        userId: true,
        projectId: true,
        issueId: true,
        hours: true,
        spentOn: true,
      },
    });
    
    // Helper function to get Monday of the week for a date
    const getWeekStart = (date: Date): Date => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      return new Date(d.setDate(diff));
    };
    
    // Group entries by user, project/issue, and week
    const weeklyGroups: { [key: string]: { hours: number; weekStart: Date; userId: string; projectId: string; issueId: string | null } } = {};
    
    for (const entry of partialTimeEntries) {
      const weekStart = getWeekStart(entry.spentOn);
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = `${entry.userId}_${entry.projectId}_${entry.issueId || 'no-issue'}_${weekStart.toISOString().split('T')[0]}`;
      
      if (!weeklyGroups[weekKey]) {
        weeklyGroups[weekKey] = {
          hours: 0,
          weekStart,
          userId: entry.userId,
          projectId: entry.projectId,
          issueId: entry.issueId,
        };
      }
      
      weeklyGroups[weekKey].hours += parseFloat(entry.hours.toString());
    }
    
    // Count groups with less than 40 hours (5 working days × 8 hours)
    const partialEntries = Object.values(weeklyGroups).filter(group => group.hours < 40).length;
    
    logger.info('Partial entries calculated (weekly)', {
      oneWeekAgo: oneWeekAgo.toISOString(),
      totalWeeklyGroups: Object.keys(weeklyGroups).length,
      partialEntries
    });

    // Get count of projects with long-running tasks (created X months ago)
    // Reuse rules from above
    const staleMonths = complianceRules.staleTaskMonths || 2;
    const staleDate = new Date();
    staleDate.setMonth(staleDate.getMonth() - staleMonths);
    
    const projectsWithStaleTasks = await prisma.project.count({
      where: {
        issues: {
          some: {
            status: {
              notIn: ['Closed', 'Resolved', 'Rejected', 'closed', 'resolved', 'rejected'],
            },
            createdAt: {
              lt: staleDate,
            },
          },
        },
      },
    });

    const overview = {
      complianceRate,
      missingEntries,
      tasksOverrun,
      lateEntryViolations, // Count of late entry violations (open violations with type 'late_entry')
      partialEntries, // Count of partial entries (hours < 8) in the last week
      pmsFlagged: managersWithViolations.length + uniqueFlaggedPMs.length,
      totalUsers,
      totalProjects,
      totalIssues,
      totalTimeEntries,
      totalViolations,
      staleTaskViolations, // Count of stale task violations (no activity in X days)
      issuesWithoutEstimates,
      projectsWithIssuesWithoutEstimates: projectsWithIssuesWithoutEstimates.length,
      flaggedPMsCount: uniqueFlaggedPMs.length,
      projectsWithStaleTasks, // Count of projects with long-running tasks (created X months ago)
    };

    logger.info('Compliance overview retrieved', { overview });
    return sendSuccess(res, overview);
  } catch (error: any) {
    logger.error('Error getting compliance overview', { error: error.message, stack: error.stack });
    return sendError(res, error.message, 500);
  }
};

/**
 * Get all users (for dropdowns, etc.) - simple list without pagination
 */
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    // Only admins can see all users
    if (req.userRole !== 'admin') {
      return sendError(res, 'Access denied. Only administrators can view the users list.', 403);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const users = await prisma.user.findMany({
      where: { 
        status: 1 // Only Active users (status 1 = Active, 2 = Registered, 3 = Locked)
      },
      select: {
        id: true,
        name: true,
        email: true,
        redmineUserId: true,
        timeEntries: {
          where: {
            spentOn: { gte: sevenDaysAgo }
          },
          orderBy: {
            spentOn: 'desc'
          },
          take: 1,
          select: {
            spentOn: true,
            hours: true
          }
        }
      },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, users);
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

// Helper function to map frontend column keys to Prisma orderBy
const getUserOrderBy = (sortBy?: string, sortOrder: 'asc' | 'desc' = 'asc'): any => {
  if (!sortBy) return { name: 'asc' };
  
  switch (sortBy) {
    case 'name':
      return { name: sortOrder };
    case 'email':
      return { email: sortOrder };
    case 'role':
      return { role: sortOrder };
    case 'lastEntryDate':
    case 'daysSinceLastEntry':
      // These are calculated fields - will sort after fetching
      // For now, sort by name as fallback
      return { name: sortOrder };
    case '_count.timeEntries':
      // Prisma doesn't support direct count sorting, will handle in post-processing
      return { name: sortOrder };
    case '_count.violations':
      // Prisma doesn't support direct count sorting, will handle in post-processing
      return { name: sortOrder };
    default:
      return { name: 'asc' };
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    // Only admins can see the users list
    if (req.userRole !== 'admin') {
      return sendError(res, 'Access denied. Only administrators can view the users list.', 403);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50; // Default 50 items per page
    const skip = (page - 1) * limit;
    const filter = req.query.filter as string; // 'missingEntries' or 'lowCompliance'
    const sortBy = req.query.sortBy as string;
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc';

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get users with entries in last 7 days
    const usersWithEntries = await prisma.timeEntry.findMany({
      where: {
        spentOn: { gte: sevenDaysAgo },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    const usersWithEntriesIds = new Set(usersWithEntries.map(e => e.userId));

    // Build where clause based on filter
    // Only show users with status 1 (Active) from Redmine
    let whereClause: any = { 
      status: 1 // Only Active users (status 1 = Active, 2 = Registered, 3 = Locked)
    };

    if (filter === 'missingEntries') {
      // Filter: users with no time entries in last 7 days
      const allActiveUsers = await prisma.user.findMany({
        where: { 
          status: 1 // Only Active users
        },
        select: { id: true },
      });
      const missingEntryUserIds = allActiveUsers
        .filter(u => !usersWithEntriesIds.has(u.id))
        .map(u => u.id);
      
      whereClause.id = { in: missingEntryUserIds };
    } else if (filter === 'lowCompliance') {
      // Filter: users with compliance rate < 80% (no entries in last 7 days)
      const allActiveUsers = await prisma.user.findMany({
        where: { 
          status: 1 // Only Active users
        },
        select: { id: true },
      });
      const lowComplianceUserIds = allActiveUsers
        .filter(u => !usersWithEntriesIds.has(u.id))
        .map(u => u.id);
      
      whereClause.id = { in: lowComplianceUserIds };
    }

    // Check if we need to sort by calculated fields
    const needsCalculatedSort = sortBy === 'lastEntryDate' || sortBy === 'daysSinceLastEntry' || 
                                 sortBy === '_count.timeEntries' || sortBy === '_count.violations';

    let users: any[];
    let total: number;

    if (needsCalculatedSort) {
      // For calculated fields, we need to fetch ALL users, sort, then paginate
      const allUsers = await prisma.user.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              timeEntries: true,
              violations: true,
            },
          },
          timeEntries: {
            orderBy: { spentOn: 'desc' },
            take: 1,
            select: { spentOn: true },
          },
        },
      });

      total = allUsers.length;

      // Calculate days since last entry for each user
      let usersWithDetails = allUsers.map(user => {
        const lastEntry = user.timeEntries[0];
        const lastEntryDate = lastEntry ? lastEntry.spentOn : null;
        const daysSinceLastEntry = lastEntryDate 
          ? Math.floor((new Date().getTime() - new Date(lastEntryDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;
        
        return {
          ...user,
          _count: user._count, // Preserve _count from Prisma query
          lastEntryDate,
          daysSinceLastEntry,
          hasRecentEntries: lastEntryDate && daysSinceLastEntry !== null && daysSinceLastEntry <= 7,
        };
      });

      // Sort by calculated fields
      usersWithDetails.sort((a, b) => {
        let aVal: any, bVal: any;
        
        if (sortBy === 'lastEntryDate') {
          // Handle null values explicitly based on sort order
          if (!a.lastEntryDate && !b.lastEntryDate) {
            // Both null, keep original order (stable sort)
            return 0;
          } else if (!a.lastEntryDate) {
            // a is null, b has date
            // For ascending: null should come first (return -1)
            // For descending: null should come last (return 1)
            return sortOrder === 'asc' ? -1 : 1;
          } else if (!b.lastEntryDate) {
            // b is null, a has date
            // For ascending: null should come first (b comes before a, return 1)
            // For descending: null should come last (b comes after a, return -1)
            return sortOrder === 'asc' ? 1 : -1;
          } else {
            // Both have dates, compare normally
            aVal = new Date(a.lastEntryDate).getTime();
            bVal = new Date(b.lastEntryDate).getTime();
          }
        } else if (sortBy === 'daysSinceLastEntry') {
          // Handle null values explicitly based on sort order
          if (a.daysSinceLastEntry === null && b.daysSinceLastEntry === null) {
            // Both null, keep original order (stable sort)
            return 0;
          } else if (a.daysSinceLastEntry === null) {
            // a is null, b has value
            // For ascending: null (infinite days) should come last (return 1)
            // For descending: null (infinite days) should come first (return -1)
            return sortOrder === 'asc' ? 1 : -1;
          } else if (b.daysSinceLastEntry === null) {
            // b is null, a has value
            // For ascending: null (infinite days) should come last (b comes after a, return -1)
            // For descending: null (infinite days) should come first (b comes before a, return 1)
            return sortOrder === 'asc' ? -1 : 1;
          } else {
            // Both have values, compare normally
            aVal = a.daysSinceLastEntry;
            bVal = b.daysSinceLastEntry;
          }
        } else if (sortBy === '_count.timeEntries') {
          aVal = a._count?.timeEntries ?? 0;
          bVal = b._count?.timeEntries ?? 0;
        } else if (sortBy === '_count.violations') {
          aVal = a._count?.violations ?? 0;
          bVal = b._count?.violations ?? 0;
        } else {
          return 0;
        }
        
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // Apply pagination after sorting
      users = usersWithDetails.slice(skip, skip + limit);
    } else {
      // For non-calculated fields, use Prisma's built-in sorting and pagination
      [users, total] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          skip,
          take: limit,
          include: {
            _count: {
              select: {
                timeEntries: true,
                violations: true,
              },
            },
            timeEntries: {
              orderBy: { spentOn: 'desc' },
              take: 1,
              select: { spentOn: true },
            },
          },
          orderBy: getUserOrderBy(sortBy, sortOrder),
        }),
        prisma.user.count({ where: whereClause }),
      ]);

      // Calculate days since last entry for each user
      users = users.map(user => {
        const lastEntry = user.timeEntries[0];
        const lastEntryDate = lastEntry ? lastEntry.spentOn : null;
        const daysSinceLastEntry = lastEntryDate 
          ? Math.floor((new Date().getTime() - new Date(lastEntryDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;
        
        return {
          ...user,
          _count: user._count, // Preserve _count from Prisma query
          lastEntryDate,
          daysSinceLastEntry,
          hasRecentEntries: lastEntryDate && daysSinceLastEntry !== null && daysSinceLastEntry <= 7,
        };
      });
    }

    return sendPaginated(res, users, page, limit, total);
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

export const getUserDetails = async (req: AuthRequest, res: Response) => {
  try {
    // Only admins can see user details
    if (req.userRole !== 'admin') {
      return sendError(res, 'Access denied. Only administrators can view user details.', 403);
    }

    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
        teamMembers: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            timeEntries: true,
            violations: true,
            assignedIssues: true,
          },
        },
      },
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    return sendSuccess(res, user);
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

export const getViolations = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;
    const violationType = req.query.violationType as string;
    const severity = req.query.severity as string;
    const userId = req.query.userId as string;

    // Special handling for partial_entry: calculate on-the-fly (weekly totals < 40 hours)
    if (violationType === 'partial_entry') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      oneWeekAgo.setHours(0, 0, 0, 0);

      // Get active user IDs first
      const activeUsers = await prisma.user.findMany({
        where: { status: 1 },
        select: { id: true, name: true, email: true },
      });
      const activeUserIds = activeUsers.map(u => u.id);

      // Get all time entries in the last week with project and issue info
      const timeEntries = await prisma.timeEntry.findMany({
        where: {
          spentOn: { gte: oneWeekAgo },
          userId: { in: activeUserIds },
          ...(userId ? { userId } : {}),
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          project: {
            select: { id: true, name: true },
          },
          issue: {
            select: { id: true, subject: true, redmineIssueId: true },
          },
        },
      });

      // Helper function to get Monday of the week for a date
      const getWeekStart = (date: Date): Date => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(d.setDate(diff));
      };

      // Group entries by user, project/issue, and week
      const weeklyGroups: { [key: string]: {
        hours: number;
        weekStart: Date;
        userId: string;
        projectId: string;
        issueId: string | null;
        project: typeof timeEntries[0]['project'];
        issue: typeof timeEntries[0]['issue'];
        user: typeof timeEntries[0]['user'];
        entries: typeof timeEntries;
      } } = {};

      for (const entry of timeEntries) {
        const weekStart = getWeekStart(entry.spentOn);
        weekStart.setHours(0, 0, 0, 0);
        const weekKey = `${entry.userId}_${entry.projectId}_${entry.issueId || 'no-issue'}_${weekStart.toISOString().split('T')[0]}`;
        
        if (!weeklyGroups[weekKey]) {
          weeklyGroups[weekKey] = {
            hours: 0,
            weekStart,
            userId: entry.userId,
            projectId: entry.projectId,
            issueId: entry.issueId,
            project: entry.project,
            issue: entry.issue,
            user: entry.user,
            entries: [],
          };
        }
        
        weeklyGroups[weekKey].hours += parseFloat(entry.hours.toString());
        weeklyGroups[weekKey].entries.push(entry);
      }

      // Filter groups with less than 40 hours (5 working days × 8 hours)
      const partialEntryGroups = Object.values(weeklyGroups).filter(group => group.hours < 40);

      // Transform weekly groups into violation-like objects
      const partialEntryViolations = partialEntryGroups.map((group) => {
        let description = `${group.hours.toFixed(2)} hours logged`;
        
        // Build description with project and issue info
        if (group.issue) {
          description = `${group.issue.subject} (${group.project.name}) - ${group.hours.toFixed(2)} hours/week`;
        } else if (group.project) {
          description = `${group.project.name} - ${group.hours.toFixed(2)} hours/week`;
        }

        return {
          id: `partial_${group.userId}_${group.projectId}_${group.issueId || 'no-issue'}_${group.weekStart.toISOString().split('T')[0]}`, // Unique ID per week/user/project/issue
          userId: group.userId,
          violationType: 'partial_entry' as const,
          date: group.weekStart, // Use week start date
          severity: 'low' as const,
          status: 'open' as const,
          metadata: {
            hours: group.hours,
            weekStart: group.weekStart,
            projectId: group.projectId,
            projectName: group.project?.name || null,
            issueId: group.issueId,
            issueSubject: group.issue?.subject || null,
            redmineIssueId: group.issue?.redmineIssueId || null,
            entriesCount: group.entries.length,
          },
          createdAt: new Date(), // Current date for display
          resolvedAt: null,
          user: group.user,
          description, // Add description field for frontend display
        };
      });

      // Apply severity filter if specified
      let filtered = partialEntryViolations;
      if (severity) {
        filtered = filtered.filter(v => v.severity === severity);
      }

      // Apply status filter if specified
      if (status) {
        filtered = filtered.filter(v => v.status === status);
      }

      // Paginate
      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limit);

      logger.info('Partial entry violations calculated on-the-fly', {
        total,
        returned: paginated.length,
        page,
        limit,
      });

      return sendPaginated(res, paginated, page, limit, total);
    }

    // For all other violation types, query the database
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (violationType) {
      where.violationType = violationType;
    }
    if (severity) {
      where.severity = severity;
    }
    if (userId) {
      where.userId = userId;
    }

    logger.info('Fetching violations', { where, page, limit });

    const [violations, total] = await Promise.all([
      prisma.complianceViolation.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.complianceViolation.count({ where }),
    ]);

    logger.info('Violations fetched', { 
      total, 
      returned: violations.length, 
      violationType: violationType || 'all',
      sampleTypes: violations.slice(0, 5).map(v => v.violationType)
    });

    return sendPaginated(res, violations, page, limit, total);
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

export const getTrends = async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily compliance data
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        spentOn: { gte: startDate },
      },
      select: {
        spentOn: true,
        userId: true,
      },
    });

    // Group by date and calculate compliance
    const dailyData: { [key: string]: { total: number; withEntries: number } } = {};
    const allUsers = await prisma.user.count({ where: { status: 1 } });

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = { total: allUsers, withEntries: 0 };
    }

    const uniqueUsersByDate: { [key: string]: Set<string> } = {};
    timeEntries.forEach((entry) => {
      const dateStr = entry.spentOn.toISOString().split('T')[0];
      if (!uniqueUsersByDate[dateStr]) {
        uniqueUsersByDate[dateStr] = new Set();
      }
      uniqueUsersByDate[dateStr].add(entry.userId);
    });

    const trends = Object.keys(dailyData).map((date) => {
      const withEntries = uniqueUsersByDate[date]?.size || 0;
      const compliance = dailyData[date].total > 0 
        ? Math.round((withEntries / dailyData[date].total) * 100) 
        : 0;
      
      return {
        date,
        compliance,
        usersWithEntries: withEntries,
        totalUsers: dailyData[date].total,
      };
    });

    return sendSuccess(res, trends);
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};

export const diagnoseOverruns = async (_req: Request, res: Response) => {
  try {
    const overrunThreshold = await configService.getOverrunThreshold();
    
    // Get raw counts
    const totalIssues = await prisma.issue.count();
    const issuesWithEstimates = await prisma.issue.count({
      where: {
        estimatedHours: { not: null, gt: 0 },
      },
    });
    
    const totalTimeEntries = await prisma.timeEntry.count();
    const timeEntriesWithIssues = await prisma.timeEntry.count({
      where: {
        issueId: { not: null },
      },
    });
    
    // Get issues with estimates and their time entries
    const issues = await prisma.issue.findMany({
      where: {
        estimatedHours: { not: null, gt: 0 },
      },
      include: {
        timeEntries: {
          select: {
            hours: true,
            issueId: true,
          },
        },
      },
      take: 10, // Sample first 10
    });
    
    const diagnostics = issues.map(issue => {
      const estimated = parseFloat(issue.estimatedHours?.toString() || '0');
      const totalSpent = issue.timeEntries.reduce(
        (sum, te) => sum + parseFloat(te.hours.toString()),
        0
      );
      const thresholdValue = estimated * overrunThreshold;
      const isOverrun = estimated > 0 && totalSpent > thresholdValue;
      
      return {
        issueId: issue.redmineIssueId,
        estimated,
        totalSpent,
        timeEntriesCount: issue.timeEntries.length,
        threshold: overrunThreshold,
        thresholdValue,
        isOverrun,
        ratio: estimated > 0 ? (totalSpent / estimated).toFixed(2) : 'N/A',
        condition: `spent (${totalSpent.toFixed(2)}) > estimated (${estimated}) * threshold (${overrunThreshold}) = ${thresholdValue.toFixed(2)}`,
        result: isOverrun ? 'OVERRUN' : 'OK',
      };
    });
    
    // Count actual overruns
    const allIssues = await prisma.issue.findMany({
      where: {
        estimatedHours: { not: null, gt: 0 },
      },
      include: {
        timeEntries: {
          select: { hours: true },
        },
      },
    });
    
    let overrunCount = 0;
    for (const issue of allIssues) {
      const estimated = parseFloat(issue.estimatedHours?.toString() || '0');
      const totalSpent = issue.timeEntries.reduce(
        (sum, te) => sum + parseFloat(te.hours.toString()),
        0
      );
      if (estimated > 0 && totalSpent > estimated * overrunThreshold) {
        overrunCount++;
      }
    }
    
    return sendSuccess(res, {
      threshold: overrunThreshold,
      summary: {
        totalIssues,
        issuesWithEstimates,
        totalTimeEntries,
        timeEntriesWithIssues,
        overrunCount,
      },
      sampleIssues: diagnostics,
    });
  } catch (error: any) {
    logger.error('Error diagnosing overruns', { error: error.message, stack: error.stack });
    return sendError(res, error.message, 500);
  }
};

export const runComplianceCheck = async (_req: Request, res: Response) => {
  try {
    // Run checks in background
    complianceService.runComplianceChecks().then(result => {
      logger.info('Compliance check complete', { violationsFound: result.violations.length });
    }).catch(error => {
      logger.error('Error running compliance check', { error: error.message, stack: error.stack });
    });

    return sendSuccess(res, {
      message: 'Compliance check started',
      status: 'running',
    });
  } catch (error: any) {
    return sendError(res, error.message, 500);
  }
};
