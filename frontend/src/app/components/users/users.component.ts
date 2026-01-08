import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { DataTableComponent, TableColumn } from '../shared/data-table/data-table.component';
import { ComplianceService } from '../../services/compliance.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, NavbarComponent, DataTableComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="users-container">
      <div class="hero-section">
        <div class="hero-header">
          <div>
            <h1>{{ pageTitle }}</h1>
            <p class="hero-subtitle">{{ pageSubtitle }}</p>
          </div>
          <button class="btn-back" (click)="goBack()">← Back to Dashboard</button>
        </div>
      </div>

      <div class="section">
        <div class="filter-info" *ngIf="filter && users.length > 0">
          <p class="info-text">
            Showing {{ users.length }} {{ filter === 'missingEntries' ? 'users with missing entries' : 'users with low compliance' }}
          </p>
        </div>
        <app-data-table
          [columns]="userColumns"
          [data]="users"
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
    .users-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .hero-section {
      margin-bottom: 3rem;
    }

    .hero-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .hero-section h1 {
      font-family: 'Sora', sans-serif;
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .hero-subtitle {
      color: var(--text-secondary);
      font-size: 1.125rem;
    }

    .btn-back {
      padding: 0.75rem 1.5rem;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-primary);
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-back:hover {
      background-color: var(--bg-tertiary);
      border-color: var(--primary);
    }

    .section {
      margin-bottom: 3rem;
    }

    .filter-info {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem 1.5rem;
      margin-bottom: 1.5rem;
    }

    .info-text {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin: 0;
    }
  `]
})
export class UsersComponent implements OnInit {
  users: any[] = [];
  pageTitle: string = 'All Users';
  pageSubtitle: string = 'View all users and their compliance status';
  filter: string = '';
  currentPage: number = 1;
  pageSize: number = 50;
  totalItems: number = 0;
  loading: boolean = false;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  userColumns: TableColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
    { key: 'lastEntryDate', label: 'Last Entry Date', sortable: true },
    { key: 'daysSinceLastEntry', label: 'Days Since Last Entry', sortable: true },
    { key: '_count.timeEntries', label: 'Total Entries', sortable: true },
    { key: '_count.violations', label: 'Violations', sortable: true }
  ];

  constructor(
    private complianceService: ComplianceService,
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
        this.loadUsers(1);
      }
    });
  }

  updatePageTitle() {
    if (this.filter === 'missingEntries') {
      this.pageTitle = 'Users with Missing Entries';
      this.pageSubtitle = 'Users who have not logged time entries in the last 7 days';
    } else if (this.filter === 'lowCompliance') {
      this.pageTitle = 'Users with Low Compliance';
      this.pageSubtitle = 'Users with compliance rate below 80% (no entries in last 7 days)';
    } else {
      this.pageTitle = 'All Users';
      this.pageSubtitle = 'View all users and their compliance status';
    }
  }

  loadUsers(page: number = 1) {
    this.loading = true;
    this.currentPage = page;
    this.complianceService.getUsers(page, this.pageSize, this.filter, this.sortColumn || undefined, this.sortDirection || undefined).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.users = (data.data || []).map((user: any) => ({
            ...user,
            role: user.role || 'user',
            lastEntryDate: user.lastEntryDate 
              ? new Date(user.lastEntryDate).toLocaleDateString() 
              : 'Never',
            daysSinceLastEntry: user.daysSinceLastEntry !== null 
              ? `${user.daysSinceLastEntry} days` 
              : 'N/A',
            _count: {
              timeEntries: user._count?.timeEntries || 0,
              violations: user._count?.violations || 0
            }
          }));
          this.totalItems = data.pagination?.total || data.total || 0;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.loading = false;
      }
    });
  }

  onPageChange(page: number) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.loadUsers(page);
  }

  onSortChange(event: { column: string; direction: 'asc' | 'desc' }) {
    this.sortColumn = event.column;
    this.sortDirection = event.direction;
    this.currentPage = 1; // Reset to page 1 when sorting changes
    this.loadUsers(1);
  }

  goBack() {
    this.router.navigate(['/']);
  }
}

