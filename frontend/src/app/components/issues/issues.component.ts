import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { DataTableComponent, TableColumn } from '../shared/data-table/data-table.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../shared/breadcrumb/breadcrumb.component';
import { IssuesService } from '../../services/issues.service';

@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [CommonModule, NavbarComponent, DataTableComponent, BreadcrumbComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="issues-container">
      <app-breadcrumb [items]="breadcrumbItems"></app-breadcrumb>
      
      <div class="page-header">
        <h2 class="section-title-small">{{ pageTitle }}</h2>
        <p class="page-subtitle" *ngIf="pageSubtitle">{{ pageSubtitle }}</p>
      </div>

      <div class="section">
        <app-data-table
          [columns]="issueColumns"
          [data]="issues"
          [title]="pageTitle"
          [showSearch]="true"
          [paginated]="true"
          [pageSize]="pageSize"
          [serverSidePagination]="true"
          [currentPage]="currentPage"
          [totalItems]="totalItems"
          [sortColumn]="sortColumn"
          [sortDirection]="sortDirection"
          (pageChange)="onPageChange($event)"
          (sortChange)="onSortChange($event)">
        </app-data-table>
      </div>
    </div>
  `,
  styles: [`
    .issues-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .section-title-small {
      font-family: 'Sora', sans-serif;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-tertiary);
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .page-subtitle {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .section {
      margin-bottom: 3rem;
    }
  `]
})
export class IssuesComponent implements OnInit {
  issues: any[] = [];
  pageTitle: string = 'All Issues';
  pageSubtitle: string = 'View all issues/tasks across all projects';
  filter: string = '';
  projectId: string = '';
  projectName: string = '';
  currentPage: number = 1;
  pageSize: number = 50;
  totalItems: number = 0;
  loading: boolean = false;
  breadcrumbItems: BreadcrumbItem[] = [];
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  issueColumns: TableColumn[] = [
    { key: 'redmineIssueId', label: 'Issue ID', sortable: true },
    { key: 'subject', label: 'Subject', sortable: true },
    { key: 'project.name', label: 'Project', sortable: true },
    { key: 'project.manager.name', label: 'Project Manager', sortable: true },
    { key: 'assignedTo.name', label: 'Assigned To', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'estimatedHours', label: 'Estimated (h)', sortable: true },
    { key: 'totalSpentHours', label: 'Spent (h)', sortable: true },
    { key: 'overrun', label: 'Overrun', sortable: true }
  ];

  constructor(
    private issuesService: IssuesService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const newFilter = params['filter'] || '';
      const newProjectId = params['projectId'] || '';
      if (this.filter !== newFilter || this.projectId !== newProjectId || this.currentPage === 1) {
        this.filter = newFilter;
        this.projectId = newProjectId;
        this.currentPage = 1; // Reset to page 1 when filter/project changes
        this.updatePageTitle();
        this.loadIssues(1);
      }
    });
  }

  updatePageTitle() {
    if (this.projectId) {
      this.pageTitle = 'Project Issues';
      this.pageSubtitle = this.projectName ? `Issues for ${this.projectName}` : 'View all issues for this project';
    } else if (this.filter === 'withoutEstimates') {
      this.pageTitle = 'Issues Without Estimates';
      this.pageSubtitle = 'Issues/tasks that have no estimated hours or zero estimates';
    } else if (this.filter === 'overrun') {
      this.pageTitle = 'Tasks Overrun';
      this.pageSubtitle = 'Tasks where spent hours exceed 150% of estimated hours';
    } else {
      this.pageTitle = 'All Issues';
      this.pageSubtitle = 'View all issues/tasks across all projects';
    }
    this.updateBreadcrumbs();
  }

  updateBreadcrumbs() {
    this.breadcrumbItems = [
      { label: 'Dashboard', route: '/' }
    ];
    
    if (this.projectId) {
      this.breadcrumbItems.push({ label: 'Projects', route: '/projects' });
      this.breadcrumbItems.push({ 
        label: this.projectName || 'Project Issues', 
        route: '/issues', 
        queryParams: { projectId: this.projectId } 
      });
    } else if (this.filter === 'withoutEstimates') {
      this.breadcrumbItems.push({ 
        label: 'Issues Without Estimates', 
        route: '/issues', 
        queryParams: { filter: this.filter } 
      });
    } else if (this.filter === 'overrun') {
      this.breadcrumbItems.push({ 
        label: 'Tasks Overrun', 
        route: '/issues', 
        queryParams: { filter: this.filter } 
      });
    } else {
      this.breadcrumbItems.push({ label: 'All Issues', route: '/issues' });
    }
  }

  loadIssues(page: number = 1) {
    this.loading = true;
    this.currentPage = page;
    this.issuesService.getIssues(page, this.pageSize, this.projectId, this.filter, this.sortColumn || undefined, this.sortDirection || undefined).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.issues = (data.data || []).map((issue: any) => {
            const estimated = issue.estimatedHours || issue.estimatedHours === 0 ? parseFloat(issue.estimatedHours) : 0;
            const spent = issue.totalSpentHours ? parseFloat(issue.totalSpentHours) : 0;
            const overrunPercent = estimated > 0 ? Math.round((spent / estimated) * 100) : 0;
            
            // Capture project name from first issue if we have projectId
            if (this.projectId && !this.projectName && issue.project?.name) {
              this.projectName = issue.project.name;
              this.updatePageTitle();
            }
            
            return {
              ...issue,
              status: issue.status || 'open',
              estimatedHours: estimated > 0 ? estimated.toFixed(1) : 'N/A',
              totalSpentHours: spent.toFixed(1),
              overrun: issue.overrun ? `Yes (${overrunPercent}%)` : 'No',
              'project.name': issue.project?.name || 'N/A',
              'project.manager.name': issue.project?.manager?.name || 'N/A',
              'assignedTo.name': issue.assignedTo?.name || 'Unassigned',
            };
          });
          this.totalItems = data.pagination?.total || data.total || 0;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading issues:', error);
        this.loading = false;
      }
    });
  }

  onPageChange(page: number) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.loadIssues(page);
  }

  onSortChange(event: { column: string; direction: 'asc' | 'desc' }) {
    this.sortColumn = event.column;
    this.sortDirection = event.direction;
    this.currentPage = 1; // Reset to page 1 when sorting changes
    this.loadIssues(1);
  }

  goBack() {
    if (this.projectId) {
      this.router.navigate(['/projects']);
    } else {
      this.router.navigate(['/']);
    }
  }
}

