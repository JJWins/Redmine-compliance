import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AIService {
  constructor(private api: ApiService) {}

  getInsights(): Observable<any> {
    return this.api.get('/ai/insights');
  }

  generateReport(period: 'week' | 'month' = 'week'): Observable<any> {
    return this.api.get(`/ai/report?period=${period}`);
  }

  detectAnomalies(): Observable<any> {
    return this.api.get('/ai/anomalies');
  }

  assessRisk(): Observable<any> {
    return this.api.get('/ai/risk');
  }

  explainViolation(violationId: string): Observable<any> {
    return this.api.get(`/ai/violations/${violationId}/explain`);
  }
}

