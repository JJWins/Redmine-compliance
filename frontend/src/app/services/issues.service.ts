import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class IssuesService {
  constructor(private api: ApiService) {}

  getIssues(page: number = 1, limit: number = 20, projectId?: string, filter?: string, sortBy?: string, sortOrder?: 'asc' | 'desc'): Observable<any> {
    let url = `/issues?page=${page}&limit=${limit}`;
    if (projectId) url += `&projectId=${projectId}`;
    if (filter) url += `&filter=${filter}`;
    if (sortBy) url += `&sortBy=${sortBy}`;
    if (sortOrder) url += `&sortOrder=${sortOrder}`;
    return this.api.get(url);
  }

  getIssueDetails(issueId: string): Observable<any> {
    return this.api.get(`/issues/${issueId}`);
  }
}

