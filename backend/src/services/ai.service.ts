import Anthropic from '@anthropic-ai/sdk';
import configService from './config.service';

/**
 * AI Service
 * Handles Claude API integration for generating insights, reports, and analysis
 */
class AIService {
  private client: Anthropic | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the client (lazy initialization)
   */
  private async initializeClient(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const settings = await configService.getAISettings();
      const apiKey = settings.apiKey || process.env.CLAUDE_API_KEY;
      
      if (apiKey && apiKey.trim().length > 0) {
        try {
          this.client = new Anthropic({
            apiKey: apiKey.trim(),
          });
          console.log('✅ Claude AI service initialized successfully');
        } catch (error: any) {
          console.error('❌ Error initializing Claude client:', error.message);
          this.client = null;
        }
      } else {
        console.warn('⚠️  Claude API key not found. AI features will be disabled.');
      }
    } catch (error: any) {
      console.error('Error loading AI settings:', error);
      // Fallback to environment variable
      const apiKey = process.env.CLAUDE_API_KEY;
      if (apiKey && apiKey.trim().length > 0) {
        this.client = new Anthropic({
          apiKey: apiKey.trim(),
        });
      }
    }
    
    this.initialized = true;
  }

  /**
   * Check if AI service is available
   */
  async isAvailable(): Promise<boolean> {
    await this.initializeClient();
    return this.client !== null;
  }

  /**
   * Get current model name
   */
  async getModel(): Promise<string> {
    try {
      const settings = await configService.getAISettings();
      return settings.model;
    } catch (error) {
      return 'claude-sonnet-4-20250514';
    }
  }

  /**
   * Get max tokens
   */
  async getMaxTokens(): Promise<number> {
    try {
      const settings = await configService.getAISettings();
      return settings.maxTokens;
    } catch (error) {
      return 4096;
    }
  }

  /**
   * Generate compliance insights from data
   */
  async generateInsights(data: {
    totalViolations: number;
    complianceRate: number;
    violationBreakdown: any;
    trends: any;
    recentViolations: any[];
    managerStats: any[];
  }): Promise<string> {
    await this.initializeClient();
    if (!this.client) {
      throw new Error('Claude API key not configured');
    }

    const settings = await configService.getAISettings();
    const model = await this.getModel();
    const maxTokens = await this.getMaxTokens();

    // Get prompt template and replace placeholders
    let prompt = settings.prompts.insights;
    prompt = prompt
      .replace(/{totalViolations}/g, data.totalViolations.toString())
      .replace(/{complianceRate}/g, data.complianceRate.toString())
      .replace(/{violationBreakdown}/g, JSON.stringify(data.violationBreakdown, null, 2))
      .replace(/{trends}/g, JSON.stringify(data.trends, null, 2))
      .replace(/{recentViolationsCount}/g, data.recentViolations.length.toString())
      .replace(/{managersCount}/g, data.managerStats.length.toString());

    try {
      const response = await this.client.messages.create({
        model: model,
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (error: any) {
      console.error('Error generating insights:', error);
      throw new Error(`Failed to generate insights: ${error.message}`);
    }
  }

  /**
   * Generate compliance report
   */
  async generateReport(data: {
    period: string;
    totalViolations: number;
    complianceRate: number;
    violationBreakdown: any;
    topViolators: any[];
    managerPerformance: any[];
    recommendations: string[];
  }): Promise<string> {
    await this.initializeClient();
    if (!this.client) {
      throw new Error('Claude API key not configured');
    }

    const settings = await configService.getAISettings();
    const model = await this.getModel();
    const maxTokens = await this.getMaxTokens();

    let prompt = settings.prompts.report;
    prompt = prompt
      .replace(/{period}/g, data.period)
      .replace(/{totalViolations}/g, data.totalViolations.toString())
      .replace(/{complianceRate}/g, data.complianceRate.toString())
      .replace(/{violationBreakdown}/g, JSON.stringify(data.violationBreakdown, null, 2))
      .replace(/{topViolators}/g, JSON.stringify(data.topViolators.slice(0, 5), null, 2))
      .replace(/{managerPerformance}/g, JSON.stringify(data.managerPerformance, null, 2));

    try {
      const response = await this.client.messages.create({
        model: model,
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (error: any) {
      console.error('Error generating report:', error);
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }

  /**
   * Detect anomalies in time entry patterns
   */
  async detectAnomalies(data: {
    userEntries: any[];
    projectEntries: any[];
    timePatterns: any[];
  }): Promise<string> {
    await this.initializeClient();
    if (!this.client) {
      throw new Error('Claude API key not configured');
    }

    const settings = await configService.getAISettings();
    const model = await this.getModel();

    let prompt = settings.prompts.anomalies;
    prompt = prompt
      .replace(/{userEntries}/g, JSON.stringify(data.userEntries.slice(0, 20), null, 2))
      .replace(/{projectEntries}/g, JSON.stringify(data.projectEntries.slice(0, 20), null, 2))
      .replace(/{timePatterns}/g, JSON.stringify(data.timePatterns, null, 2));

    try {
      const response = await this.client.messages.create({
        model: model,
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (error: any) {
      console.error('Error detecting anomalies:', error);
      throw new Error(`Failed to detect anomalies: ${error.message}`);
    }
  }

  /**
   * Assess risk levels for violations and users
   */
  async assessRisk(data: {
    violations: any[];
    userCompliance: any[];
    projectHealth: any[];
  }): Promise<string> {
    await this.initializeClient();
    if (!this.client) {
      throw new Error('Claude API key not configured');
    }

    const settings = await configService.getAISettings();
    const model = await this.getModel();

    let prompt = settings.prompts.risk;
    prompt = prompt
      .replace(/{violationsCount}/g, data.violations.length.toString())
      .replace(/{userCompliance}/g, JSON.stringify(data.userCompliance.slice(0, 10), null, 2))
      .replace(/{projectHealth}/g, JSON.stringify(data.projectHealth.slice(0, 10), null, 2));

    try {
      const response = await this.client.messages.create({
        model: model,
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (error: any) {
      console.error('Error assessing risk:', error);
      throw new Error(`Failed to assess risk: ${error.message}`);
    }
  }

  /**
   * Explain why a violation occurred (contextual explanation)
   */
  async explainViolation(violation: any, userHistory: any, context: any): Promise<string> {
    await this.initializeClient();
    if (!this.client) {
      throw new Error('Claude API key not configured');
    }

    const settings = await configService.getAISettings();
    const model = await this.getModel();

    let prompt = settings.prompts.explainViolation;
    prompt = prompt
      .replace(/{violationType}/g, violation.violationType)
      .replace(/{userName}/g, violation.user?.name || 'Unknown')
      .replace(/{violationDate}/g, violation.date)
      .replace(/{severity}/g, violation.severity)
      .replace(/{metadata}/g, JSON.stringify(violation.metadata, null, 2))
      .replace(/{userHistory}/g, JSON.stringify(userHistory, null, 2))
      .replace(/{context}/g, JSON.stringify(context, null, 2));

    try {
      const response = await this.client.messages.create({
        model: model,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (error: any) {
      console.error('Error explaining violation:', error);
      throw new Error(`Failed to explain violation: ${error.message}`);
    }
  }
}

export default new AIService();

