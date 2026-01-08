import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.utils';
import configService from '../services/config.service';
import cronService from '../services/cron.service';

export const getConfig = async (req: Request, res: Response) => {
  try {
    const allConfig = await configService.getAllConfig();
    return sendSuccess(res, allConfig);
  } catch (error: any) {
    console.error('Error getting config:', error);
    return sendError(res, error.message, 500);
  }
};

export const getComplianceRules = async (req: Request, res: Response) => {
  try {
    const rules = await configService.getComplianceRules();
    return sendSuccess(res, rules);
  } catch (error: any) {
    console.error('Error getting compliance rules:', error);
    return sendError(res, error.message, 500);
  }
};

export const updateComplianceRules = async (req: Request, res: Response) => {
  try {
    const { 
      missingEntryDays, 
      bulkLoggingThreshold, 
      lateEntryDays,
      lateEntryCheckDays,
      staleTaskDays, 
      overrunThreshold,
      staleTaskMonths,
      maxSpentHours
    } = req.body;

    const updates: any = {};
    if (missingEntryDays !== undefined) updates.missingEntryDays = parseFloat(missingEntryDays);
    if (bulkLoggingThreshold !== undefined) updates.bulkLoggingThreshold = parseFloat(bulkLoggingThreshold);
    if (lateEntryDays !== undefined) updates.lateEntryDays = parseFloat(lateEntryDays);
    if (lateEntryCheckDays !== undefined) updates.lateEntryCheckDays = parseInt(lateEntryCheckDays);
    if (staleTaskDays !== undefined) updates.staleTaskDays = parseFloat(staleTaskDays);
    if (overrunThreshold !== undefined) updates.overrunThreshold = parseFloat(overrunThreshold);
    if (staleTaskMonths !== undefined) updates.staleTaskMonths = parseInt(staleTaskMonths);
    if (maxSpentHours !== undefined) updates.maxSpentHours = parseInt(maxSpentHours);

    // Validate overrunThreshold (now stored as percentage)
    if (updates.overrunThreshold !== undefined) {
      // Handle backward compatibility: if value < 10, it's old format (multiplier), convert to percentage
      if (updates.overrunThreshold < 10) {
        updates.overrunThreshold = updates.overrunThreshold * 100;
      }
      // Validate percentage range: 100% to 1000%
      if (updates.overrunThreshold < 100 || updates.overrunThreshold > 1000) {
        return sendError(res, 'Overrun threshold must be between 100% and 1000%', 400);
      }
    }

    // Validate staleTaskMonths
    if (updates.staleTaskMonths !== undefined) {
      if (updates.staleTaskMonths < 1 || updates.staleTaskMonths > 12) {
        return sendError(res, 'Stale task months must be between 1 and 12', 400);
      }
    }

    // Validate maxSpentHours
    if (updates.maxSpentHours !== undefined) {
      if (updates.maxSpentHours < 1 || updates.maxSpentHours > 10000) {
        return sendError(res, 'Max spent hours must be between 1 and 10000', 400);
      }
    }

    // Validate lateEntryCheckDays
    if (updates.lateEntryCheckDays !== undefined) {
      if (updates.lateEntryCheckDays < 1 || updates.lateEntryCheckDays > 365) {
        return sendError(res, 'Late entry check days must be between 1 and 365', 400);
      }
    }

    // Validate lateEntryDays
    if (updates.lateEntryDays !== undefined) {
      if (updates.lateEntryDays < 1 || updates.lateEntryDays > 30) {
        return sendError(res, 'Late entry days threshold must be between 1 and 30', 400);
      }
    }

    await configService.updateComplianceRules(updates);
    const updatedRules = await configService.getComplianceRules();
    
    return sendSuccess(res, updatedRules);
  } catch (error: any) {
    console.error('Error updating compliance rules:', error);
    return sendError(res, error.message, 500);
  }
};

export const getCronStatus = async (req: Request, res: Response) => {
  try {
    const status = cronService.getStatus();
    return sendSuccess(res, status);
  } catch (error: any) {
    console.error('Error getting cron status:', error);
    return sendError(res, error.message, 500);
  }
};

