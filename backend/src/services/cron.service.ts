import cron from 'node-cron';
import syncService from './sync.service';
import complianceService from './compliance.service';
import prisma from '../config/database';

/**
 * Cron Job Service
 * Manages scheduled tasks for syncs and compliance checks
 */
class CronService {
  private dailySyncJob: cron.ScheduledTask | null = null;

  /**
   * Initialize and start all cron jobs
   */
  initialize(): void {
    console.log('⏰ Initializing cron jobs...');

    // Daily incremental sync at 11 PM
    // Cron format: minute hour day month day-of-week
    // '0 23 * * *' = 11:00 PM every day
    const cronSchedule = process.env.DAILY_SYNC_CRON || '0 23 * * *';
    const timezone = process.env.CRON_TIMEZONE || 'UTC';

    this.dailySyncJob = cron.schedule(cronSchedule, async () => {
      await this.runDailySyncAndCompliance();
    }, {
      scheduled: true,
      timezone: timezone
    });

    console.log('✅ Cron jobs initialized');
    console.log(`📅 Daily incremental sync scheduled: ${cronSchedule} (${timezone})`);
    console.log('   This will run incremental syncs, then compliance checks');
  }

  /**
   * Run daily incremental sync followed by compliance checks
   */
  private async runDailySyncAndCompliance(): Promise<void> {
    const startTime = new Date();
    console.log('\n========================================');
    console.log('🔄 Starting scheduled daily sync and compliance check');
    console.log(`⏰ Time: ${startTime.toISOString()}`);
    console.log('========================================\n');

    try {
      // Step 1: Run incremental sync for all entities
      console.log('📥 Step 1: Running incremental sync...');
      const syncResult = await syncService.incrementalSync();
      
      console.log('\n📊 Sync Summary:');
      console.log(`  Users: ${syncResult.users.synced} synced, ${syncResult.users.errors} errors`);
      console.log(`  Projects: ${syncResult.projects.synced} synced, ${syncResult.projects.errors} errors`);
      console.log(`  Issues: ${syncResult.issues.synced} synced, ${syncResult.issues.errors} errors`);
      console.log(`  Time Entries: ${syncResult.timeEntries.synced} synced, ${syncResult.timeEntries.errors} errors`);

      const totalSynced = syncResult.users.synced + 
                         syncResult.projects.synced + 
                         syncResult.issues.synced + 
                         syncResult.timeEntries.synced;
      const totalErrors = syncResult.users.errors + 
                          syncResult.projects.errors + 
                          syncResult.issues.errors + 
                          syncResult.timeEntries.errors;

      if (totalErrors > 0) {
        console.warn(`⚠️  Sync completed with ${totalErrors} errors`);
      } else {
        console.log('✅ All syncs completed successfully');
      }

      // Step 2: Run compliance checks after sync completes
      console.log('\n🔍 Step 2: Running compliance checks...');
      const complianceResult = await complianceService.runComplianceChecks();

      console.log('\n📊 Compliance Check Summary:');
      console.log(`  Total Violations Detected: ${complianceResult.violations.length}`);
      console.log(`  Users Checked: ${complianceResult.scores.size}`);

      // Log compliance check
      await prisma.syncLog.create({
        data: {
          syncType: 'incremental',
          entityType: 'compliance_check',
          recordsSynced: complianceResult.violations.length,
          status: 'success',
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
      
      console.log('\n========================================');
      console.log('✅ Daily sync and compliance check completed');
      console.log(`⏱️  Duration: ${duration} seconds`);
      console.log(`⏰ Completed at: ${endTime.toISOString()}`);
      console.log('========================================\n');

    } catch (error: any) {
      console.error('\n❌ Error in daily sync and compliance check:', error);
      
      // Log error
      await prisma.syncLog.create({
        data: {
          syncType: 'incremental',
          entityType: 'daily_job',
          recordsSynced: 0,
          status: 'failed',
          errorMessage: error.message || 'Unknown error',
          startedAt: startTime,
          completedAt: new Date(),
        },
      });

      console.error('❌ Daily job failed. Check logs for details.');
    }
  }

  /**
   * Stop all cron jobs
   */
  stop(): void {
    if (this.dailySyncJob) {
      this.dailySyncJob.stop();
      console.log('⏰ Cron jobs stopped');
    }
  }

  /**
   * Get status of cron jobs
   */
  getStatus(): {
    dailySyncEnabled: boolean;
    nextRun: string | null;
  } {
    return {
      dailySyncEnabled: this.dailySyncJob !== null,
      nextRun: this.dailySyncJob ? 'Daily at 11:00 PM UTC' : null
    };
  }
}

export default new CronService();

