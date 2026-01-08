import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RedmineService {
  constructor(private api: ApiService) {}

  getStatus(): Observable<any> {
    return this.api.get('/redmine/status');
  }

  triggerSync(type: 'full' | 'incremental', entity?: 'issues' | 'timeEntries'): Observable<any> {
    const body: any = { type };
    if (entity) body.entity = entity;
    return this.api.post('/redmine/sync', body);
  }
}

