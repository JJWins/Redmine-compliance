import { Component, Input, OnChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="data-table-container">
      <div class="table-header" *ngIf="title">
        <h3>{{ title }}</h3>
        <div class="table-actions" *ngIf="showSearch">
          <input 
            type="text" 
            class="search-input" 
            placeholder="Search..." 
            [(ngModel)]="searchTerm"
            (input)="onSearch()">
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th *ngFor="let col of columns" [class.sortable]="col.sortable !== false" (click)="col.sortable !== false ? sort(col.key) : null">
                {{ col.label }}
                <span class="sort-icon" *ngIf="col.sortable !== false && sortColumn === col.key">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of filteredData" [class.clickable]="clickableRows" (click)="onRowClick(row)">
              <td *ngFor="let col of columns">
                <!-- Severity Badge -->
                <ng-container *ngIf="col.key === 'severity' && row.severityBadge">
                  <span [class]="'badge ' + row.severityBadge.class">
                    {{ row.severityBadge.text }}
                  </span>
                </ng-container>
                <!-- Status Badge -->
                <ng-container *ngIf="col.key === 'status' && row.statusBadge">
                  <span [class]="'badge ' + row.statusBadge.class">
                    {{ row.statusBadge.text }}
                  </span>
                </ng-container>
                <!-- Status (regular value if no badge) -->
                <ng-container *ngIf="col.key === 'status' && !row.statusBadge">
                  <span *ngIf="row[col.key] !== null && row[col.key] !== undefined">
                    {{ row[col.key] }}
                  </span>
                  <span *ngIf="row[col.key] === null || row[col.key] === undefined" class="empty-value">
                    N/A
                  </span>
                </ng-container>
                <!-- Violation Type (formatted) -->
                <ng-container *ngIf="col.key === 'violationType' && row.violationTypeFormatted">
                  {{ row.violationTypeFormatted }}
                </ng-container>
                <!-- Description (with styling) -->
                <ng-container *ngIf="col.key === 'description'">
                  <span class="violation-description">{{ row.description || 'N/A' }}</span>
                </ng-container>
                <!-- Nested values -->
                <ng-container *ngIf="col.key.includes('.') && col.key !== 'severity' && col.key !== 'status' && col.key !== 'violationType' && col.key !== 'description'">
                  {{ getNestedValue(row, col.key) }}
                </ng-container>
                <!-- Regular values -->
                <ng-container *ngIf="!col.key.includes('.') && col.key !== 'severity' && col.key !== 'status' && col.key !== 'violationType' && col.key !== 'description'">
                  <span *ngIf="row[col.key] !== null && row[col.key] !== undefined">
                    {{ row[col.key] }}
                  </span>
                  <span *ngIf="row[col.key] === null || row[col.key] === undefined" class="empty-value">
                    N/A
                  </span>
                </ng-container>
              </td>
            </tr>
            <tr *ngIf="filteredData.length === 0">
              <td [attr.colspan]="columns.length" class="empty-state">
                No data available
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="table-footer" *ngIf="paginated">
        <div class="pagination-info">
          Showing {{ totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0 }} to {{ Math.min(currentPage * pageSize, totalItems) }} of {{ totalItems }}
        </div>
        <div class="pagination-controls">
          <button (click)="previousPage()" [disabled]="currentPage === 1 || totalPages === 0">Previous</button>
          <span class="page-info">Page {{ currentPage }} of {{ totalPages || 1 }}</span>
          <button (click)="nextPage()" [disabled]="currentPage === totalPages || totalPages === 0">Next</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .data-table-container {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }

    .table-header {
      padding: 1.5rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .table-header h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .table-actions {
      display: flex;
      gap: 1rem;
    }

    .search-input {
      padding: 0.5rem 1rem;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 0.875rem;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--primary);
    }

    .table-wrapper {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background-color: var(--bg-secondary);
    }

    th {
      padding: 1rem;
      text-align: left;
      font-weight: 500;
      color: var(--text-secondary);
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-family: 'Sora', sans-serif;
    }

    th.sortable {
      cursor: pointer;
      user-select: none;
    }

    th.sortable:hover {
      background-color: var(--bg-tertiary);
    }

    .sort-icon {
      margin-left: 0.5rem;
      color: var(--primary);
    }

    tbody tr {
      border-bottom: 1px solid var(--border);
      transition: background-color 0.2s;
    }

    tbody tr:hover {
      background-color: var(--bg-secondary);
    }

    tbody tr.clickable {
      cursor: pointer;
    }

    tbody tr.clickable:hover {
      background-color: var(--bg-tertiary);
    }

    td {
      padding: 1rem;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-tertiary);
    }

    .empty-value {
      color: var(--text-tertiary);
      font-style: italic;
    }

    .table-footer {
      padding: 1.5rem;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .pagination-info {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .pagination-controls {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .pagination-controls button {
      padding: 0.5rem 1rem;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-primary);
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.2s;
    }

    .pagination-controls button:hover:not(:disabled) {
      background-color: var(--bg-tertiary);
      border-color: var(--primary);
    }

    .pagination-controls button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .page-info {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-severity-high {
      background-color: rgba(239, 68, 68, 0.15);
      color: #EF4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .badge-severity-medium {
      background-color: rgba(245, 158, 11, 0.15);
      color: #F59E0B;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .badge-severity-low {
      background-color: rgba(34, 197, 94, 0.15);
      color: #22C55E;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .badge-status-open {
      background-color: rgba(239, 68, 68, 0.15);
      color: #EF4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .badge-status-resolved {
      background-color: rgba(34, 197, 94, 0.15);
      color: #22C55E;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .badge-status-ignored {
      background-color: rgba(107, 114, 128, 0.15);
      color: #6B7280;
      border: 1px solid rgba(107, 114, 128, 0.3);
    }

    .violation-description {
      font-size: 0.875rem;
      color: var(--text-secondary);
      line-height: 1.4;
    }
  `]
})
export class DataTableComponent implements OnChanges {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() title: string = '';
  @Input() showSearch: boolean = true;
  @Input() paginated: boolean = false;
  @Input() pageSize: number = 50;
  @Input() clickableRows: boolean = false;
  @Input() serverSidePagination: boolean = false; // New: server-side pagination mode
  @Input() currentPage: number = 1; // New: page number from parent
  @Input() totalItems: number = 0; // New: total items from server
  @Input() sortColumn: string = ''; // New: current sort column from parent
  @Input() sortDirection: 'asc' | 'desc' = 'asc'; // New: current sort direction from parent
  @Output() rowClick = new EventEmitter<any>();
  @Output() pageChange = new EventEmitter<number>(); // New: emit page changes to parent
  @Output() sortChange = new EventEmitter<{ column: string; direction: 'asc' | 'desc' }>(); // New: emit sort changes to parent

  searchTerm: string = '';
  filteredData: any[] = [];
  totalPages: number = 1;

  Math = Math;

  ngOnChanges(changes: any) {
    if (this.serverSidePagination) {
      // Server-side pagination: use data as-is, calculate pages from totalItems
      this.filteredData = [...this.data];
      this.totalPages = Math.ceil(this.totalItems / this.pageSize);
      // Don't reset currentPage - it's controlled by parent
    } else {
      // Client-side pagination: paginate locally
      this.filteredData = [...this.data];
      this.totalItems = this.data.length;
      this.totalPages = Math.ceil(this.totalItems / this.pageSize);
      // Only reset page if data actually changed (not just currentPage input)
      if (changes['data'] && !changes['currentPage']) {
        this.currentPage = 1;
      }
      this.applyPagination();
    }
  }

  onSearch() {
    if (!this.searchTerm) {
      this.filteredData = [...this.data];
    } else {
      this.filteredData = this.data.filter(row => {
        return Object.values(row).some(val => 
          String(val).toLowerCase().includes(this.searchTerm.toLowerCase())
        );
      });
    }
    this.totalItems = this.filteredData.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);
    this.currentPage = 1;
    this.applyPagination();
  }

  sort(column: string) {
    if (this.serverSidePagination) {
      // Server-side sorting: emit event to parent
      let newDirection: 'asc' | 'desc' = 'asc';
      if (this.sortColumn === column) {
        newDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      }
      this.sortChange.emit({ column, direction: newDirection });
    } else {
      // Client-side sorting: sort locally
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = column;
        this.sortDirection = 'asc';
      }

      this.filteredData.sort((a, b) => {
        const aVal = this.getNestedValue(a, column);
        const bVal = this.getNestedValue(b, column);
        
        if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });

      this.applyPagination();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      const newPage = this.currentPage - 1;
      if (this.serverSidePagination) {
        this.pageChange.emit(newPage);
        this.scrollToTop();
      } else {
        this.currentPage = newPage;
        this.applyPagination();
        this.scrollToTop();
      }
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      const newPage = this.currentPage + 1;
      if (this.serverSidePagination) {
        this.pageChange.emit(newPage);
        this.scrollToTop();
      } else {
        this.currentPage = newPage;
        this.applyPagination();
        this.scrollToTop();
      }
    }
  }

  private scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private applyPagination() {
    if (this.paginated && !this.serverSidePagination) {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      this.filteredData = this.filteredData.slice(start, end);
    }
  }

  getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, p) => o?.[p], obj);
  }

  onRowClick(row: any) {
    if (this.clickableRows) {
      this.rowClick.emit(row);
    }
  }
}

