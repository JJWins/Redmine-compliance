import prisma from '../config/database';
import { ViolationType, ViolationSeverity } from '@prisma/client';
import configService from './config.service';

interface ComplianceCheckResult {
  violations: Array<{
    userId: string;
    violationType: ViolationType;
    date: Date;
    severity: ViolationSeverity;
    metadata: any;
  }>;
  scores: Map<string, number>; // userId -> compliance score (0-100)
}

class ComplianceService {
  /**
   * Run all compliance checks and generate violations
   */
  async runComplianceChecks(date: Date = new Date()): Promise<ComplianceCheckResult> {
    const violations: ComplianceCheckResult['violations'] = [];
    const scores = new Map<string, number>();

    console.log('🔍 Running compliance checks...');

    // Run all checks
    const [
      missingEntries,
      bulkLogging,
      lateEntries,
      roundNumbers,
      staleTasks,
      overrunTasks,
      partialEntries,
    ] = await Promise.all([
      this.detectMissingEntries(date),
      this.detectBulkLogging(date),
      this.detectLateEntries(date),
      this.detectRoundNumbers(date),
      this.detectStaleTasks(date),
      this.detectOverrunTasks(),
      this.detectPartialEntries(date),
    ]);

    // Combine all violations
    violations.push(...missingEntries);
    violations.push(...bulkLogging);
    violations.push(...lateEntries);
    violations.push(...roundNumbers);
    violations.push(...staleTasks);
    violations.push(...overrunTasks);
    violations.push(...partialEntries);

    // Log violation counts by type before storing
    const violationCounts: { [key: string]: number } = {};
    violations.forEach(v => {
      violationCounts[v.violationType] = (violationCounts[v.violationType] || 0) + 1;
    });
    console.log(`📊 Violations by type before storing:`, violationCounts);

    // Calculate compliance scores for each user (only Active users - status 1)
    const allUsers = await prisma.user.findMany({
      where: { status: 1 },
    });

    for (const user of allUsers) {
      const userViolations = violations.filter(v => v.userId === user.id);
      const score = this.calculateComplianceScore(userViolations);
      scores.set(user.id, score);
    }

    // Store violations in database
    await this.storeViolations(violations);

    console.log(`✅ Compliance check complete: ${violations.length} violations found`);

    return { violations, scores };
  }

  /**
   * Detect users with missing time entries (no entry in last 7 days)
   */
  async detectMissingEntries(checkDate: Date): Promise<ComplianceCheckResult['violations']> {
    const violations: ComplianceCheckResult['violations'] = [];
    const sevenDaysAgo = new Date(checkDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeUsers = await prisma.user.findMany({
      where: { status: 1 }, // Only Active users
    });

    const usersWithEntries = await prisma.timeEntry.findMany({
      where: {
        spentOn: { gte: sevenDaysAgo },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const usersWithEntriesIds = new Set(usersWithEntries.map(e => e.userId));

    for (const user of activeUsers) {
      if (!usersWithEntriesIds.has(user.id)) {
        violations.push({
          userId: user.id,
          violationType: 'missing_entry',
          date: checkDate,
          severity: 'high',
          metadata: {
            daysWithoutEntry: 7,
            lastEntryDate: null,
          },
        });
      }
    }

    return violations;
  }

  /**
   * Detect bulk logging (multiple days logged in one session)
   */
  async detectBulkLogging(checkDate: Date): Promise<ComplianceCheckResult['violations']> {
    const violations: ComplianceCheckResult['violations'] = [];
    const sevenDaysAgo = new Date(checkDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get time entries with same created_on timestamp (bulk logging indicator)
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        createdOn: { gte: sevenDaysAgo },
      },
    });

    // Group by user and created_on timestamp
    const groupedByUserAndTime: { [key: string]: typeof timeEntries } = {};
    
    timeEntries.forEach(entry => {
      const key = `${entry.userId}_${entry.createdOn.toISOString()}`;
      if (!groupedByUserAndTime[key]) {
        groupedByUserAndTime[key] = [];
      }
      groupedByUserAndTime[key].push(entry);
    });

    // Check for bulk logging (3+ entries created at same time)
    for (const [, entries] of Object.entries(groupedByUserAndTime)) {
      if (entries.length >= 3) {
        // Check if entries span multiple days
        const dates = new Set(entries.map(e => e.spentOn.toISOString().split('T')[0]));
        if (dates.size >= 3) {
          violations.push({
            userId: entries[0].userId,
            violationType: 'bulk_logging',
            date: checkDate,
            severity: 'medium',
            metadata: {
              entriesCount: entries.length,
              daysSpanned: dates.size,
              createdOn: entries[0].createdOn,
            },
          });
        }
      }
    }

    return violations;
  }

  /**
   * Detect late entries (entry created more than X days after spent_on date)
   * Uses configurable threshold and time window
   */
  async detectLateEntries(checkDate: Date): Promise<ComplianceCheckResult['violations']> {
    const violations: ComplianceCheckResult['violations'] = [];
    
    // Get configurable values
    const rules = await configService.getComplianceRules();
    const lateEntryCheckDays = rules.lateEntryCheckDays || 30; // Default: 30 days (1 month)
    const lateEntryDays = rules.lateEntryDays || 3; // Default: 3 days threshold
    
    console.log(`🔍 Late Entry Detection: Using check window of ${lateEntryCheckDays} days, threshold of ${lateEntryDays} days`);
    
    const checkWindowStart = new Date(checkDate);
    checkWindowStart.setDate(checkWindowStart.getDate() - lateEntryCheckDays);
    
    console.log(`🔍 Checking entries created from ${checkWindowStart.toISOString()} to ${checkDate.toISOString()}`);

    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        createdOn: { gte: checkWindowStart },
      },
    });

    for (const entry of timeEntries) {
      const daysLate = Math.floor(
        (entry.createdOn.getTime() - entry.spentOn.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Use configurable threshold instead of hardcoded 2
      if (daysLate > lateEntryDays) {
        violations.push({
          userId: entry.userId,
          violationType: 'late_entry',
          date: entry.spentOn,
          severity: daysLate > 7 ? 'high' : 'medium',
          metadata: {
            daysLate,
            spentOn: entry.spentOn,
            createdOn: entry.createdOn,
          },
        });
      }
    }

    return violations;
  }

  /**
   * Detect round numbers (suspiciously round hours like 8.0, 4.0, 2.0)
   */
  async detectRoundNumbers(checkDate: Date): Promise<ComplianceCheckResult['violations']> {
    const violations: ComplianceCheckResult['violations'] = [];
    const sevenDaysAgo = new Date(checkDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        spentOn: { gte: sevenDaysAgo },
      },
    });

    // Group by user and count round numbers
    const userRoundNumbers: { [userId: string]: number } = {};

    for (const entry of timeEntries) {
      const hours = parseFloat(entry.hours.toString());
      // Check if hours is a round number (8.0, 4.0, 2.0, etc.) and >= 2 hours
      if (hours >= 2 && hours % 1 === 0 && hours % 2 === 0) {
        if (!userRoundNumbers[entry.userId]) {
          userRoundNumbers[entry.userId] = 0;
        }
        userRoundNumbers[entry.userId]++;
      }
    }

    // Flag users with 5+ round number entries
    for (const [userId, count] of Object.entries(userRoundNumbers)) {
      if (count >= 5) {
        violations.push({
          userId,
          violationType: 'round_numbers',
          date: checkDate,
          severity: 'low',
          metadata: {
            roundNumberEntries: count,
            period: '7 days',
          },
        });
      }
    }

    return violations;
  }

  /**
   * Detect stale tasks (issues with no time entries in configured days but still open)
   * Uses staleTaskDays from configuration (default: 14 days)
   */
  async detectStaleTasks(checkDate: Date): Promise<ComplianceCheckResult['violations']> {
    const violations: ComplianceCheckResult['violations'] = [];
    
    // Get configured stale task days from config service
    const rules = await configService.getComplianceRules();
    const staleTaskDays = rules.staleTaskDays || 14;
    
    const cutoffDate = new Date(checkDate);
    cutoffDate.setDate(cutoffDate.getDate() - staleTaskDays);
    // Set time to start of day to ensure consistent date comparison
    cutoffDate.setHours(0, 0, 0, 0);

    // Get open issues (status not "Closed" or "Resolved")
    const openIssues = await prisma.issue.findMany({
      where: {
        status: {
          notIn: ['Closed', 'Resolved', 'Rejected'],
        },
      },
      include: {
        timeEntries: {
          where: {
            spentOn: { gte: cutoffDate },
          },
        },
        assignedTo: true,
      },
    });

    for (const issue of openIssues) {
      if (issue.timeEntries.length === 0 && issue.assignedToId) {
        violations.push({
          userId: issue.assignedToId,
          violationType: 'stale_task',
          date: checkDate,
          severity: 'medium',
          metadata: {
            issueId: issue.id,
            issueSubject: issue.subject,
            daysSinceLastEntry: staleTaskDays,
          },
        });
      }
    }

    return violations;
  }

  /**
   * Detect overrun tasks (issues where spent hours > estimated * threshold)
   */
  async detectOverrunTasks(): Promise<ComplianceCheckResult['violations']> {
    const violations: ComplianceCheckResult['violations'] = [];
    const overrunThreshold = await configService.getOverrunThreshold();

    const issues = await prisma.issue.findMany({
      where: {
        estimatedHours: { not: null },
      },
      include: {
        timeEntries: {
          select: { hours: true },
        },
        assignedTo: true,
      },
    });

    for (const issue of issues) {
      const estimated = parseFloat(issue.estimatedHours?.toString() || '0');
      if (estimated > 0 && issue.assignedToId) {
        const totalSpent = issue.timeEntries.reduce(
          (sum, te) => sum + parseFloat(te.hours.toString()),
          0
        );

        if (totalSpent > estimated * overrunThreshold) {
          violations.push({
            userId: issue.assignedToId,
            violationType: 'overrun_task',
            date: new Date(),
            severity: totalSpent > estimated * 2 ? 'high' : 'medium',
            metadata: {
              issueId: issue.id,
              issueSubject: issue.subject,
              estimatedHours: estimated,
              spentHours: totalSpent,
              overrunPercentage: Math.round(((totalSpent - estimated) / estimated) * 100),
            },
          });
        }
      }
    }

    return violations;
  }

  /**
   * Detect partial entries (weekly totals < 40 hours for 5 working days)
   * Groups entries by user, project/issue, and week, then checks if total < 40 hours
   */
  async detectPartialEntries(checkDate: Date): Promise<ComplianceCheckResult['violations']> {
    const violations: ComplianceCheckResult['violations'] = [];
    const oneWeekAgo = new Date(checkDate);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);

    // Get active user IDs first
    const activeUsers = await prisma.user.findMany({
      where: { status: 1 },
      select: { id: true },
    });
    const activeUserIds = activeUsers.map(u => u.id);

    // Get all time entries in the last week
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        spentOn: { gte: oneWeekAgo },
        userId: { in: activeUserIds },
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        issue: {
          select: { id: true, subject: true },
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
      projectName: string | null;
      issueSubject: string | null;
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
          projectName: entry.project?.name || null,
          issueSubject: entry.issue?.subject || null,
        };
      }
      
      weeklyGroups[weekKey].hours += parseFloat(entry.hours.toString());
    }

    // Create violations for groups with less than 40 hours (5 working days × 8 hours)
    for (const group of Object.values(weeklyGroups)) {
      if (group.hours < 40) {
        violations.push({
          userId: group.userId,
          violationType: 'partial_entry',
          date: group.weekStart, // Use week start date
          severity: 'low',
          metadata: {
            hours: group.hours,
            weekStart: group.weekStart,
            projectId: group.projectId,
            projectName: group.projectName,
            issueId: group.issueId,
            issueSubject: group.issueSubject,
          },
        });
      }
    }

    console.log(`🔍 Partial Entry Detection: Found ${Object.keys(weeklyGroups).length} weekly groups, ${violations.length} with < 40 hours`);
    return violations;
  }

  /**
   * Calculate compliance score (0-100) based on violations
   */
  calculateComplianceScore(violations: ComplianceCheckResult['violations']): number {
    if (violations.length === 0) return 100;

    let score = 100;
    const severityPenalties = {
      low: 2,
      medium: 5,
      high: 10,
    };

    for (const violation of violations) {
      score -= severityPenalties[violation.severity];
    }

    return Math.max(0, score);
  }

  /**
   * Store violations in database
   */
  async storeViolations(violations: ComplianceCheckResult['violations']): Promise<void> {
    let created = 0;
    let updated = 0;
    let errors = 0;
    const typeCounts: { [key: string]: number } = {};

    for (const violation of violations) {
      try {
        // Count by type for logging
        typeCounts[violation.violationType] = (typeCounts[violation.violationType] || 0) + 1;

        // Normalize date to start of day for consistent comparison (date field is @db.Date)
        const normalizedDate = new Date(violation.date);
        normalizedDate.setHours(0, 0, 0, 0);

        // Check if violation already exists for this user/type/date
        const existing = await prisma.complianceViolation.findFirst({
          where: {
            userId: violation.userId,
            violationType: violation.violationType,
            date: normalizedDate,
          },
        });

        if (existing) {
          // Update existing violation
          await prisma.complianceViolation.update({
            where: { id: existing.id },
            data: {
              severity: violation.severity,
              metadata: violation.metadata,
              status: 'open', // Reset to open if it was resolved
            },
          });
          updated++;
        } else {
          // Create new violation
          await prisma.complianceViolation.create({
            data: {
              userId: violation.userId,
              violationType: violation.violationType,
              date: normalizedDate,
              severity: violation.severity,
              metadata: violation.metadata,
              status: 'open',
            },
          });
          created++;
        }
      } catch (error: any) {
        console.error(`Error storing violation for user ${violation.userId}, type ${violation.violationType}:`, error.message);
        if (error.message.includes('Invalid value') || error.message.includes('ViolationType')) {
          console.error('⚠️ ViolationType enum issue - make sure Prisma client is regenerated with partial_entry');
        }
        errors++;
      }
    }

    console.log(`📝 Stored violations: ${created} created, ${updated} updated, ${errors} errors`);
    console.log(`📊 Violations by type:`, typeCounts);
  }

  /**
   * Get user compliance score
   */
  async getUserComplianceScore(userId: string): Promise<number> {
    const violations = await prisma.complianceViolation.findMany({
      where: {
        userId,
        status: 'open',
      },
    });

    return this.calculateComplianceScore(
      violations.map(v => ({
        userId: v.userId,
        violationType: v.violationType,
        date: v.date,
        severity: v.severity,
        metadata: v.metadata as any,
      }))
    );
  }
}

export default new ComplianceService();
