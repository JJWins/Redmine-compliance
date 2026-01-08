import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  constructor(private api: ApiService) {}

  getComplianceRules(): Observable<any> {
    return this.api.get('/config/compliance-rules');
  }

  updateComplianceRules(rules: {
    missingEntryDays?: number;
    bulkLoggingThreshold?: number;
    lateEntryDays?: number;
    lateEntryCheckDays?: number;
    staleTaskDays?: number;
    overrunThreshold?: number;
    staleTaskMonths?: number;
    maxSpentHours?: number;
  }): Observable<any> {
    return this.api.put('/config/compliance-rules', rules);
  }

  getAISettings(): Observable<any> {
    return this.api.get('/ai/settings');
  }

  updateAISettings(settings: {
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
  }): Observable<any> {
    return this.api.put('/ai/settings', settings);
  }
}

