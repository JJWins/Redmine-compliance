import prisma from '../config/database';

/**
 * Configuration Service
 * Manages system configuration stored in system_config table
 */
class ConfigService {
  private readonly COMPLIANCE_RULES_KEY = 'compliance_rules';
  private readonly AI_SETTINGS_KEY = 'ai_settings';

  /**
   * Get compliance rules configuration
   */
  async getComplianceRules(): Promise<{
    missingEntryDays: number;
    bulkLoggingThreshold: number;
    lateEntryDays: number;
    lateEntryCheckDays: number;
    staleTaskDays: number;
    overrunThreshold: number;
    staleTaskMonths: number;
    maxSpentHours: number;
  }> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: this.COMPLIANCE_RULES_KEY },
      });

      if (!config || !config.value) {
        // Return defaults if not found
        return {
          missingEntryDays: 7,
          bulkLoggingThreshold: 3,
          lateEntryDays: 3,
          lateEntryCheckDays: 30,
          staleTaskDays: 14,
          overrunThreshold: 150, // Stored as percentage (150 = 150%)
          staleTaskMonths: 2,
          maxSpentHours: 350,
        };
      }

      const rules = config.value as any;
      return {
        missingEntryDays: rules.missingEntryDays || 7,
        bulkLoggingThreshold: rules.bulkLoggingThreshold || 3,
        lateEntryDays: rules.lateEntryDays || 3,
        lateEntryCheckDays: rules.lateEntryCheckDays || 30,
        staleTaskDays: rules.staleTaskDays || 14,
        // Handle backward compatibility: if value < 10, it's old format (multiplier), convert to percentage
        overrunThreshold: rules.overrunThreshold 
          ? (rules.overrunThreshold < 10 ? rules.overrunThreshold * 100 : rules.overrunThreshold)
          : 150, // Default: 150% (was 1.5x)
        staleTaskMonths: rules.staleTaskMonths || 2,
        maxSpentHours: rules.maxSpentHours || 350,
      };
    } catch (error) {
      console.error('Error getting compliance rules:', error);
      // Return defaults on error
      return {
        missingEntryDays: 7,
        bulkLoggingThreshold: 3,
        lateEntryDays: 3,
        lateEntryCheckDays: 30,
        staleTaskDays: 14,
        overrunThreshold: 150, // Stored as percentage (150 = 150%)
        staleTaskMonths: 2,
        maxSpentHours: 350,
      };
    }
  }

  /**
   * Get overrun threshold as multiplier (for calculations)
   * Returns percentage / 100 (e.g., 150% -> 1.5)
   */
  async getOverrunThreshold(): Promise<number> {
    const rules = await this.getComplianceRules();
    // overrunThreshold is stored as percentage, convert to multiplier for calculations
    return rules.overrunThreshold / 100;
  }

  /**
   * Get overrun percentage (for display)
   */
  async getOverrunPercentage(): Promise<number> {
    const rules = await this.getComplianceRules();
    return rules.overrunThreshold;
  }

  /**
   * Update compliance rules configuration
   */
  async updateComplianceRules(rules: {
    missingEntryDays?: number;
    bulkLoggingThreshold?: number;
    lateEntryDays?: number;
    lateEntryCheckDays?: number;
    staleTaskDays?: number;
    overrunThreshold?: number;
    staleTaskMonths?: number;
    maxSpentHours?: number;
  }): Promise<void> {
    try {
      const currentRules = await this.getComplianceRules();
      
      // Convert overrunThreshold to percentage if it's in old format (multiplier < 10)
      const processedRules: any = { ...rules };
      if (processedRules.overrunThreshold !== undefined) {
        // If value is < 10, it's old format (multiplier), convert to percentage
        if (processedRules.overrunThreshold < 10) {
          processedRules.overrunThreshold = processedRules.overrunThreshold * 100;
        }
      }
      
      const updatedRules = {
        ...currentRules,
        ...processedRules,
      };

      await prisma.systemConfig.upsert({
        where: { key: this.COMPLIANCE_RULES_KEY },
        update: {
          value: updatedRules as any,
          description: 'Compliance detection rules',
        },
        create: {
          key: this.COMPLIANCE_RULES_KEY,
          value: updatedRules as any,
          description: 'Compliance detection rules',
        },
      });
    } catch (error) {
      console.error('Error updating compliance rules:', error);
      throw error;
    }
  }

  /**
   * Get all configuration
   */
  async getAllConfig(): Promise<any> {
    try {
      const configs = await prisma.systemConfig.findMany();
      const configMap: any = {};
      
      configs.forEach(config => {
        configMap[config.key] = config.value;
      });

      return configMap;
    } catch (error) {
      console.error('Error getting all config:', error);
      throw error;
    }
  }

  /**
   * Get AI settings (model, API key, prompts)
   */
  async getAISettings(): Promise<{
    model: string;
    apiKey: string;
    maxTokens: number;
    prompts: {
      insights: string;
      report: string;
      anomalies: string;
      risk: string;
      explainViolation: string;
    };
  }> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: this.AI_SETTINGS_KEY },
      });

      if (!config || !config.value) {
        // No config in DB - return minimal defaults (will be set via UI)
        return {
          model: 'claude-sonnet-4-20250514',
          apiKey: process.env.CLAUDE_API_KEY || '',
          maxTokens: 4096,
          prompts: {
            insights: '',
            report: '',
            anomalies: '',
            risk: '',
            explainViolation: ''
          }
        };
      }

      const settings = config.value as any;

      // Use ONLY prompts from database - no hardcoded fallbacks
      return {
        model: settings.model || 'claude-sonnet-4-20250514',
        apiKey: settings.apiKey || process.env.CLAUDE_API_KEY || '',
        maxTokens: settings.maxTokens || 4096,
        prompts: {
          insights: settings.prompts?.insights || '',
          report: settings.prompts?.report || '',
          anomalies: settings.prompts?.anomalies || '',
          risk: settings.prompts?.risk || '',
          explainViolation: settings.prompts?.explainViolation || ''
        }
      };
    } catch (error) {
      console.error('Error getting AI settings:', error);
      throw error;
    }
  }

  /**
   * Update AI settings
   */
  async updateAISettings(settings: {
    model?: string;
    apiKey?: string;
    maxTokens?: number;
    prompts?: {
      insights?: string;
      report?: string;
      anomalies?: string;
      risk?: string;
      explainViolation?: string;
    };
  }): Promise<void> {
    try {
      const currentSettings = await this.getAISettings();
      
      const updatedSettings = {
        ...currentSettings,
        ...settings,
        prompts: {
          ...currentSettings.prompts,
          ...(settings.prompts || {})
        }
      };

      await prisma.systemConfig.upsert({
        where: { key: this.AI_SETTINGS_KEY },
        update: {
          value: updatedSettings as any,
          description: 'AI service settings (model, API key, prompts)',
        },
        create: {
          key: this.AI_SETTINGS_KEY,
          value: updatedSettings as any,
          description: 'AI service settings (model, API key, prompts)',
        },
      });

      // Update environment variable if API key changed
      if (settings.apiKey) {
        process.env.CLAUDE_API_KEY = settings.apiKey;
      }
    } catch (error) {
      console.error('Error updating AI settings:', error);
      throw error;
    }
  }
}

export default new ConfigService();

