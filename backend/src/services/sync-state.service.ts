import prisma from '../config/database';

/**
 * Sync State Service
 * Tracks last sync time for each entity type to enable incremental syncs
 */
class SyncStateService {
  private readonly SYNC_STATE_KEY = 'sync_state';

  /**
   * Get last sync time for an entity type
   */
  async getLastSyncTime(entityType: 'users' | 'projects' | 'issues' | 'timeEntries'): Promise<Date | null> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: this.SYNC_STATE_KEY },
      });

      if (!config || !config.value) {
        return null;
      }

      const syncState = config.value as any;
      const lastSync = syncState[entityType];

      return lastSync ? new Date(lastSync) : null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Update last sync time for an entity type
   */
  async updateLastSyncTime(entityType: 'users' | 'projects' | 'issues' | 'timeEntries', syncTime: Date = new Date()): Promise<void> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: this.SYNC_STATE_KEY },
      });

      const syncState = config?.value as any || {};

      syncState[entityType] = syncTime.toISOString();

      await prisma.systemConfig.upsert({
        where: { key: this.SYNC_STATE_KEY },
        update: {
          value: syncState,
          updatedAt: new Date(),
        },
        create: {
          key: this.SYNC_STATE_KEY,
          value: syncState,
          description: 'Last sync times for each entity type',
        },
      });
    } catch (error) {
      console.error('Error updating last sync time:', error);
    }
  }

  /**
   * Get all sync times
   */
  async getAllSyncTimes(): Promise<{
    users: Date | null;
    projects: Date | null;
    issues: Date | null;
    timeEntries: Date | null;
  }> {
    const [users, projects, issues, timeEntries] = await Promise.all([
      this.getLastSyncTime('users'),
      this.getLastSyncTime('projects'),
      this.getLastSyncTime('issues'),
      this.getLastSyncTime('timeEntries'),
    ]);

    return { users, projects, issues, timeEntries };
  }

  /**
   * Reset sync state (for full sync)
   */
  async resetSyncState(): Promise<void> {
    await prisma.systemConfig.deleteMany({
      where: { key: this.SYNC_STATE_KEY },
    });
  }
}

export default new SyncStateService();
