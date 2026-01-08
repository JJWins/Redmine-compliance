import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor(private api: ApiService) {}

  getPatterns(): Observable<any> {
    return this.api.get('/analytics/patterns');
  }

  getManagersComparison(): Observable<any> {
    return this.api.get('/analytics/managers');
  }
}

