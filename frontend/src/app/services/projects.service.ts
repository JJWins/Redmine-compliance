import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProjectsService {
  constructor(private api: ApiService) {}

  getProjects(page: number = 1, limit: number = 20, status?: string, filter?: string, sortBy?: string, sortOrder?: 'asc' | 'desc'): Observable<any> {
    let url = `/projects?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    if (filter) url += `&filter=${filter}`;
    if (sortBy) url += `&sortBy=${sortBy}`;
    if (sortOrder) url += `&sortOrder=${sortOrder}`;
    return this.api.get(url);
  }

  getProjectDetails(projectId: string): Observable<any> {
    return this.api.get(`/projects/${projectId}`);
  }

  getProjectOverruns(projectId: string): Observable<any> {
    return this.api.get(`/projects/${projectId}/overruns`);
  }

  getProjectsWithStaleTasks(page: number = 1, limit: number = 50): Observable<any> {
    return this.api.get(`/projects/health/stale-tasks?page=${page}&limit=${limit}`);
  }

  getProjectsWithHighSpentHours(page: number = 1, limit: number = 50): Observable<any> {
    return this.api.get(`/projects/health/high-spent?page=${page}&limit=${limit}`);
  }

  updateProjectManager(projectId: string, managerId: string | null): Observable<any> {
    return this.api.put(`/projects/${projectId}/manager`, { managerId });
  }
}

