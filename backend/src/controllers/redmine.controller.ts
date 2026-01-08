import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.utils';
import redmineService from '../services/redmine.service';
import syncService from '../services/sync.service';
import syncStateService from '../services/sync-state.service';
import logger from '../utils/logger';

export const triggerSync = async (req: Request, res: Response) => {
  try {
    const { type = 'full', entity } = req.body;

    // Start sync in background (don't wait for completion)
    if (type === 'full') {
      if (entity === 'issues') {
        // Sync only issues - full sync (all issues)
        syncService.syncIssues(undefined, undefined, false).then(result => {
          logger.info('Issues sync complete', { synced: result.synced, errors: result.errors });
        }).catch((error) => {
          logger.error('Issues sync error', { error: error.message, stack: error.stack });
        });
        return sendSuccess(res, { 
          message: 'Issues full sync started',
          status: 'running'
        });
      } else if (entity === 'timeEntries') {
        // Sync only time entries - full sync (last 90 days, can extend later)
        const daysBack = req.body.daysBack || 90; // Default 90, can be extended
        syncService.syncTimeEntries(undefined, undefined, false, daysBack).then(result => {
          logger.info('Time entries sync complete', { synced: result.synced, errors: result.errors, daysBack });
        }).catch((error) => {
          logger.error('Time entries sync error', { error: error.message, stack: error.stack, daysBack });
        });
        return sendSuccess(res, { 
          message: `Time entries full sync started (last ${daysBack} days)`,
          status: 'running',
          daysBack
        });
      } else {
        // Full sync - all entities
        syncService.fullSync().catch((error) => {
          logger.error('Background full sync error', { error: error.message, stack: error.stack });
        });
        return sendSuccess(res, { 
          message: 'Full sync started (all entities)',
          status: 'running'
        });
      }
    } else if (type === 'incremental') {
      // Incremental sync - only changes since last sync
      syncService.incrementalSync().catch((error) => {
        logger.error('Background incremental sync error', { error: error.message, stack: error.stack });
      });
      return sendSuccess(res, { 
        message: 'Incremental sync started (only changes since last sync)',
        status: 'running'
      });
    } else {
      return sendError(res, 'Invalid sync type. Use "full" or "incremental"', 400);
    }
  } catch (error: any) {
    logger.error('Trigger sync error', { error: error.message, stack: error.stack, body: req.body });
    return sendError(res, error.message, 500);
  }
};

export const getStatus = async (_req: Request, res: Response) => {
  try {
    const connected = await redmineService.testConnection();
    const syncTimes = await syncStateService.getAllSyncTimes();
    
    return sendSuccess(res, { 
      connected,
      redmineUrl: process.env.REDMINE_URL,
      hasApiKey: !!process.env.REDMINE_API_KEY,
      lastSyncTimes: {
        users: syncTimes.users?.toISOString() || null,
        projects: syncTimes.projects?.toISOString() || null,
        issues: syncTimes.issues?.toISOString() || null,
        timeEntries: syncTimes.timeEntries?.toISOString() || null,
      }
    });
  } catch (error: any) {
    logger.error('Get Redmine status error', { error: error.message, stack: error.stack });
    return sendError(res, error.message, 500);
  }
};
