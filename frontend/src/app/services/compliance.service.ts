import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ComplianceService {
  constructor(private api: ApiService) {}

  getOverview(): Observable<any> {
    return this.api.get('/compliance/overview');
  }

  getUsers(page: number = 1, limit: number = 20, filter?: string, sortBy?: string, sortOrder?: 'asc' | 'desc'): Observable<any> {
    let url = `/compliance/users?page=${page}&limit=${limit}`;
    if (filter) {
      url += `&filter=${filter}`;
    }
    if (sortBy) {
      url += `&sortBy=${sortBy}`;
    }
    if (sortOrder) {
      url += `&sortOrder=${sortOrder}`;
    }
    return this.api.get(url);
  }

  getUserDetails(id: string): Observable<any> {
    return this.api.get(`/compliance/users/${id}`);
  }

  getViolations(page: number = 1, limit: number = 50, violationType?: string, severity?: string, status?: string, userId?: string): Observable<any> {
    let url = `/compliance/violations?page=${page}&limit=${limit}`;
    if (violationType) url += `&violationType=${violationType}`;
    if (severity) url += `&severity=${severity}`;
    if (status) url += `&status=${status}`;
    if (userId) url += `&userId=${userId}`;
    return this.api.get(url);
  }

  getTrends(days?: number): Observable<any> {
    const params = days ? `?days=${days}` : '';
    return this.api.get(`/compliance/trends${params}`);
  }

  runComplianceCheck(): Observable<any> {
    return this.api.post('/compliance/check', {});
  }

  getAllUsers(): Observable<any> {
    return this.api.get('/compliance/users/all');
  }
}

