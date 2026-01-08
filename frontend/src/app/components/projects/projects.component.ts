import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { DataTableComponent, TableColumn } from '../shared/data-table/data-table.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../shared/breadcrumb/breadcrumb.component';
import { ProjectsService } from '../../services/projects.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, NavbarComponent, DataTableComponent, BreadcrumbComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="projects-container">
      <app-breadcrumb [items]="breadcrumbItems"></app-breadcrumb>
      
      <div class="page-header">
        <h2 class="section-title-small">{{ pageTitle }}</h2>
        <p class="page-subtitle" *ngIf="pageSubtitle">{{ pageSubtitle }}</p>
      </div>

      <div class="section">
        <app-data-table
          [columns]="projectColumns"
          [data]="projects"
          [title]="pageTitle"
          [showSearch]="true"
          [paginated]="true"
          [pageSize]="pageSize"
          [serverSidePagination]="true"
          [currentPage]="currentPage"
          [totalItems]="totalItems"
          [sortColumn]="sortColumn"
          [sortDirection]="sortDirection"
          [clickableRows]="true"
          (rowClick)="onRowClick($event)"
          (pageChange)="onPageChange($event)"
          (sortChange)="onSortChange($event)">
        </app-data-table>
      </div>
    </div>
  `,
  styles: [`
    .projects-container {
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
export class ProjectsComponent implements OnInit {
  projects: any[] = [];
  pageTitle: string = 'All Projects';
  pageSubtitle: string = '';
  filter: string = '';
  currentPage: number = 1;
  pageSize: number = 50;
  totalItems: number = 0;
  loading: boolean = false;
  breadcrumbItems: BreadcrumbItem[] = [];
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  projectColumns: TableColumn[] = [
    { key: 'name', label: 'Project Name', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'manager.name', label: 'Manager', sortable: true },
    { key: 'manager.email', label: 'Manager Email', sortable: true },
    { key: '_count.issues', label: 'Total Issues', sortable: true },
    { key: 'issuesWithoutEstimates', label: 'Issues Without Estimates', sortable: true },
    { key: '_count.timeEntries', label: 'Time Entries', sortable: true }
  ];

  constructor(
    private projectsService: ProjectsService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Get filter from query params
    this.route.queryParams.subscribe(params => {
      const newFilter = params['filter'] || '';
      if (this.filter !== newFilter || this.currentPage === 1) {
        this.filter = newFilter;
        this.currentPage = 1; // Reset to page 1 when filter changes
        this.updatePageTitle();
        this.loadProjects(1);
      }
    });
    this.updateBreadcrumbs();
  }

  updatePageTitle() {
    if (this.filter === 'issuesWithoutEstimates') {
      this.pageTitle = 'Projects with Issues';
      this.pageSubtitle = 'Projects that have issues without time estimates';
    } else {
      this.pageTitle = 'All Projects';
      this.pageSubtitle = 'View all projects and their health status';
    }
    this.updateBreadcrumbs();
  }

  updateBreadcrumbs() {
    this.breadcrumbItems = [
      { label: 'Dashboard', route: '/' }
    ];
    
    if (this.filter === 'issuesWithoutEstimates') {
      this.breadcrumbItems.push({ label: 'Projects with Issues', route: '/projects', queryParams: { filter: this.filter } });
    } else {
      this.breadcrumbItems.push({ label: 'All Projects', route: '/projects' });
    }
  }

  loadProjects(page: number = 1) {
    this.loading = true;
    this.currentPage = page;
    this.projectsService.getProjects(page, this.pageSize, undefined, this.filter, this.sortColumn || undefined, this.sortDirection || undefined).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.projects = (data.data || []).map((project: any) => ({
            ...project,
            status: project.status || 'active',
            issuesWithoutEstimates: project.issuesWithoutEstimates || 0,
            'manager.name': project.manager?.name || 'N/A',
            'manager.email': project.manager?.email || 'N/A'
          }));
          this.totalItems = data.pagination?.total || data.total || 0;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading projects:', error);
        this.loading = false;
      }
    });
  }

  onPageChange(page: number) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.loadProjects(page);
  }

  onSortChange(event: { column: string; direction: 'asc' | 'desc' }) {
    this.sortColumn = event.column;
    this.sortDirection = event.direction;
    this.currentPage = 1; // Reset to page 1 when sorting changes
    this.loadProjects(1);
  }

  onRowClick(row: any) {
    // Navigate to issues page filtered by this project
    this.router.navigate(['/issues'], { queryParams: { projectId: row.id } });
  }

  goBack() {
    this.router.navigate(['/']);
  }
}

