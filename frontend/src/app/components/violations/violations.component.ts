import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { DataTableComponent, TableColumn } from '../shared/data-table/data-table.component';
import { ComplianceService } from '../../services/compliance.service';
import { IssuesService } from '../../services/issues.service';

@Component({
  selector: 'app-violations',
  standalone: true,
  imports: [CommonModule, NavbarComponent, DataTableComponent, FormsModule],
  template: `
    <app-navbar></app-navbar>
    <div class="violations-container">
      <div class="section">
        <div class="section-header">
          <h2 class="section-title-small">Compliance Violations</h2>
          <button class="btn-back" (click)="goBack()">← Back to Dashboard</button>
        </div>
        
        <!-- Filters -->
        <div class="filters-card">
          <div class="filters-grid">
            <div class="filter-group filter-group-wide">
              <label for="userFilter">User</label>
              <div class="user-search-wrapper">
                <input 
                  type="text"
                  id="userFilter"
                  [(ngModel)]="userSearchTerm"
                  (input)="filterUsers()"
                  (focus)="showUserDropdown = true"
                  placeholder="Search user by name or email..."
                  class="user-search-input"
                  autocomplete="off">
                <div class="user-dropdown" *ngIf="showUserDropdown && filteredUsers.length > 0">
                  <div 
                    class="user-option" 
                    *ngFor="let user of filteredUsers"
                    (click)="selectUser(user)">
                    <div class="user-name">{{ user.name }}</div>
                    <div class="user-email">{{ user.email }}</div>
                    <div class="user-violation-count" *ngIf="user.violationCount !== undefined">
                      {{ user.violationCount }} violation{{ user.violationCount !== 1 ? 's' : '' }}
                    </div>
                  </div>
                  <div class="user-option user-option-clear" (click)="clearUserFilter()">
                    Clear selection (Show all users)
                  </div>
                </div>
                <div class="user-dropdown" *ngIf="showUserDropdown && filteredUsers.length === 0 && userSearchTerm">
                  <div class="user-option user-option-no-results">No users found</div>
                </div>
              </div>
              <div class="selected-user-display" *ngIf="selectedUser">
                <span class="selected-user-badge">
                  {{ selectedUser.name }}
                  <button type="button" class="remove-user-btn" (click)="clearUserFilter()">×</button>
                </span>
              </div>
            </div>

            <div class="filter-group">
              <label for="violationTypeFilter" class="filter-label-with-info">
                Violation Type
                <span 
                  class="info-icon-small"
                  (mouseenter)="showTooltip = 'violationType'"
                  (mouseleave)="showTooltip = ''"
                  title="Click for details">
                  ℹ️
                </span>
                <div class="tooltip" *ngIf="showTooltip === 'violationType'">
                  <div class="tooltip-content">
                    <strong>Violation Types:</strong>
                    <ul>
                      <li><strong>Missing Entry:</strong> User has no time entries in last 7 days</li>
                      <li><strong>Late Entry:</strong> Entry created more than 2 days after work date</li>
                      <li><strong>Bulk Logging:</strong> Multiple days logged in one session (3+ entries)</li>
                      <li><strong>Round Numbers:</strong> Suspicious pattern of round hour entries (5+ in 7 days)</li>
                      <li><strong>Stale Task:</strong> Open task with no time entries in 14 days</li>
                      <li><strong>Overrun Task:</strong> Task exceeds estimated hours by threshold</li>
                      <li><strong>Partial Entry:</strong> Time entry with less than 8 hours logged in the last week</li>
                    </ul>
                  </div>
                </div>
              </label>
              <select 
                id="violationTypeFilter"
                [(ngModel)]="selectedViolationType"
                (change)="applyFilters()"
                class="filter-select">
                <option value="">All Types</option>
                <option value="missing_entry">Missing Entry</option>
                <option value="late_entry">Late Entry</option>
                <option value="bulk_logging">Bulk Logging</option>
                <option value="round_numbers">Round Numbers</option>
                <option value="stale_task">Stale Task</option>
                <option value="overrun_task">Overrun Task</option>
                <option value="partial_entry">Partial Entry</option>
              </select>
            </div>

            <div class="filter-group">
              <label for="severityFilter" class="filter-label-with-info">
                Severity
                <span 
                  class="info-icon-small"
                  (mouseenter)="showTooltip = 'severity'"
                  (mouseleave)="showTooltip = ''"
                  title="Click for details">
                  ℹ️
                </span>
                <div class="tooltip" *ngIf="showTooltip === 'severity'">
                  <div class="tooltip-content">
                    <strong>Severity Levels:</strong>
                    <ul>
                      <li><span class="badge badge-severity-high">High</span> - Critical issues requiring immediate attention</li>
                      <li><span class="badge badge-severity-medium">Medium</span> - Important issues that should be addressed</li>
                      <li><span class="badge badge-severity-low">Low</span> - Minor issues or patterns worth monitoring</li>
                    </ul>
                    <p><strong>Examples:</strong></p>
                    <ul>
                      <li>High: Missing entries, late entries (>7 days), overrun tasks (>200%)</li>
                      <li>Medium: Late entries (2-7 days), bulk logging, stale tasks, overrun tasks (150-200%)</li>
                      <li>Low: Round numbers pattern</li>
                    </ul>
                  </div>
                </div>
              </label>
              <select 
                id="severityFilter"
                [(ngModel)]="selectedSeverity"
                (change)="applyFilters()"
                class="filter-select">
                <option value="">All Severities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div class="filter-group">
              <label for="statusFilter">Status</label>
              <select 
                id="statusFilter"
                [(ngModel)]="selectedStatus"
                (change)="applyFilters()"
                class="filter-select">
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>

            <div class="filter-actions">
              <button class="btn-clear" (click)="clearFilters()">Clear Filters</button>
            </div>
          </div>
        </div>

        <!-- Violations Table -->
        <div class="violations-table-card">
          <app-data-table
            [columns]="violationColumns"
            [data]="violations"
            [showSearch]="true"
            [paginated]="true"
            [pageSize]="pageSize"
            [serverSidePagination]="true"
            [currentPage]="currentPage"
            [totalItems]="totalItems"
            [clickableRows]="true"
            (pageChange)="onPageChange($event)"
            (rowClick)="onViolationClick($event)">
          </app-data-table>
        </div>
      </div>

      <!-- Task Details Modal -->
      <div class="modal-overlay" *ngIf="showTaskModal" (click)="closeTaskModal()">
        <div class="modal-content task-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="modal-title">Task Details</h3>
            <button class="modal-close" (click)="closeTaskModal()">×</button>
          </div>
          
          <div class="modal-body" *ngIf="selectedTask">
            <div class="task-info-section">
              <div class="task-field">
                <label>Task Subject:</label>
                <div class="task-value">{{ selectedTask.subject }}</div>
              </div>
              
              <div class="task-field">
                <label>Status:</label>
                <div class="task-value">
                  <span class="task-status-badge" [class]="'status-' + selectedTask.status.toLowerCase()">
                    {{ selectedTask.status }}
                  </span>
                </div>
              </div>

              <div class="task-field">
                <label>Assigned To:</label>
                <div class="task-value">{{ selectedTask.assignedTo?.name || 'Unassigned' }}</div>
              </div>

              <div class="task-field">
                <label>Project:</label>
                <div class="task-value">{{ selectedTask.project?.name || 'N/A' }}</div>
              </div>

              <div class="task-field">
                <label>Estimated Hours:</label>
                <div class="task-value">
                  {{ selectedTask.estimatedHours ? (selectedTask.estimatedHours + ' hours') : 'Not estimated' }}
                </div>
              </div>

              <div class="task-field">
                <label>Total Spent Hours:</label>
                <div class="task-value">
                  <strong>{{ selectedTask.totalSpentHours?.toFixed(2) || '0.00' }} hours</strong>
                </div>
              </div>

              <div class="task-field">
                <label>Created:</label>
                <div class="task-value">{{ formatDate(selectedTask.createdAt) }}</div>
              </div>

              <div class="task-field">
                <label>Last Updated:</label>
                <div class="task-value">{{ formatDate(selectedTask.updatedAt) }}</div>
              </div>

              <div class="task-field" *ngIf="selectedTask.description">
                <label>Description:</label>
                <div class="task-value task-description">{{ selectedTask.description }}</div>
              </div>
            </div>

            <!-- Time Entries Section -->
            <div class="time-entries-section">
              <h4 class="section-subtitle">Time Entries</h4>
              <div class="time-entries-list" *ngIf="selectedTask.timeEntries && selectedTask.timeEntries.length > 0">
                <div class="time-entry-item" *ngFor="let entry of selectedTask.timeEntries">
                  <div class="entry-date">{{ formatDate(entry.spentOn) }}</div>
                  <div class="entry-hours">{{ entry.hours }} hours</div>
                  <div class="entry-user">{{ entry.user?.name || 'Unknown' }}</div>
                  <div class="entry-comments" *ngIf="entry.comments">{{ entry.comments }}</div>
                </div>
              </div>
              <div class="no-entries" *ngIf="!selectedTask.timeEntries || selectedTask.timeEntries.length === 0">
                <p>No time entries found for this task.</p>
                <p class="no-entries-note">This is why it's flagged as a stale task - no activity in the last 14 days.</p>
              </div>
            </div>
          </div>

          <div class="modal-body loading-state" *ngIf="loadingTask">
            <p>Loading task details...</p>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeTaskModal()">Close</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .violations-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .section {
      margin-bottom: 3rem;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .section-title-small {
      font-family: 'Sora', sans-serif;
      font-size: 1rem;
      font-weight: 500;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0;
    }

    .btn-back {
      padding: 0.5rem 1rem;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-back:hover {
      background-color: var(--bg-tertiary);
      border-color: var(--primary);
    }

    .filters-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      align-items: start;
    }

    @media (min-width: 768px) {
      .filters-grid {
        grid-template-columns: 2fr 1fr 1fr 1fr;
      }
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .filter-group label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .filter-label-with-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      position: relative;
    }

    .info-icon-small {
      font-size: 0.875rem;
      cursor: help;
      opacity: 0.6;
      transition: opacity 0.2s;
      line-height: 1;
    }

    .info-icon-small:hover {
      opacity: 1;
    }

    .tooltip {
      position: absolute;
      top: 100%;
      left: 0;
      z-index: 1000;
      margin-top: 0.5rem;
      min-width: 300px;
      max-width: 400px;
    }

    .tooltip-content {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--text-secondary);
    }

    .tooltip-content strong {
      color: var(--text-primary);
      font-weight: 600;
      display: block;
      margin-bottom: 0.5rem;
    }

    .tooltip-content ul {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
    }

    .tooltip-content li {
      margin: 0.5rem 0;
    }

    .tooltip-content p {
      margin: 0.75rem 0 0.5rem 0;
    }

    .tooltip-content .badge {
      display: inline-block;
      margin-right: 0.5rem;
    }

    .filter-select {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .filter-select:focus {
      outline: none;
      border-color: var(--primary);
    }

    .filter-group-wide {
      grid-column: span 2;
    }

    .user-search-wrapper {
      position: relative;
    }

    .user-search-input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 0.875rem;
      transition: all 0.2s;
    }

    .user-search-input:focus {
      outline: none;
      border-color: var(--primary);
    }

    .user-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 0.25rem;
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      max-height: 300px;
      overflow-y: auto;
      z-index: 1000;
    }

    .user-option {
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: background-color 0.2s;
      border-bottom: 1px solid var(--border);
    }

    .user-option:last-child {
      border-bottom: none;
    }

    .user-option:hover {
      background-color: var(--bg-secondary);
    }

    .user-option-clear {
      background-color: var(--bg-secondary);
      font-weight: 500;
      color: var(--primary);
    }

    .user-option-no-results {
      color: var(--text-tertiary);
      font-style: italic;
      cursor: default;
    }

    .user-option-no-results:hover {
      background-color: transparent;
    }

    .user-name {
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
    }

    .user-email {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-bottom: 0.25rem;
    }

    .user-violation-count {
      font-size: 0.75rem;
      color: var(--text-tertiary);
      font-style: italic;
    }

    .selected-user-display {
      margin-top: 0.5rem;
    }

    .selected-user-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      background-color: var(--primary);
      color: white;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .remove-user-btn {
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 1.125rem;
      line-height: 1;
      padding: 0;
      width: 1.25rem;
      height: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    }

    .remove-user-btn:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }

    .filter-actions {
      display: flex;
      align-items: flex-end;
    }

    .btn-clear {
      padding: 0.5rem 1rem;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-clear:hover {
      background-color: var(--bg-tertiary);
      border-color: var(--primary);
    }

    .violations-table-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
    }

    /* Task Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease-in;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .task-modal {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      max-width: 800px;
      width: 90%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid var(--border);
    }

    .modal-title {
      font-family: 'Sora', sans-serif;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .modal-close {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 0;
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .modal-close:hover {
      background-color: var(--bg-secondary);
      color: var(--text-primary);
    }

    .modal-body {
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1;
    }

    .modal-body.loading-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
    }

    .task-info-section {
      margin-bottom: 2rem;
    }

    .task-field {
      margin-bottom: 1rem;
    }

    .task-field label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .task-value {
      font-size: 0.9375rem;
      color: var(--text-primary);
      line-height: 1.5;
    }

    .task-description {
      background-color: var(--bg-secondary);
      padding: 1rem;
      border-radius: 6px;
      white-space: pre-wrap;
      max-height: 200px;
      overflow-y: auto;
    }

    .task-status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: capitalize;
    }

    .task-status-badge.status-open,
    .task-status-badge.status-new,
    .task-status-badge.status-in-progress {
      background-color: rgba(34, 197, 94, 0.15);
      color: #22C55E;
    }

    .task-status-badge.status-closed,
    .task-status-badge.status-resolved {
      background-color: rgba(107, 114, 128, 0.15);
      color: #6B7280;
    }

    .section-subtitle {
      font-family: 'Sora', sans-serif;
      font-size: 1rem;
      font-weight: 500;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    .time-entries-section {
      margin-top: 2rem;
    }

    .time-entries-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .time-entry-item {
      padding: 1rem;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      display: grid;
      grid-template-columns: 120px 100px 1fr;
      gap: 1rem;
      align-items: start;
    }

    .entry-date {
      font-weight: 500;
      color: var(--text-primary);
    }

    .entry-hours {
      font-weight: 600;
      color: var(--primary);
    }

    .entry-user {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .entry-comments {
      grid-column: 1 / -1;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-style: italic;
    }

    .no-entries {
      text-align: center;
      padding: 2rem;
      color: var(--text-secondary);
    }

    .no-entries-note {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: var(--text-tertiary);
      font-style: italic;
    }

    .modal-footer {
      padding: 1.5rem;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
    }
  `]
})
export class ViolationsComponent implements OnInit {
  violations: any[] = [];
  currentPage: number = 1;
  pageSize: number = 50;
  totalItems: number = 0;
  loading: boolean = false;
  
  // Filters
  selectedUserId: string = '';
  selectedUser: any = null;
  selectedViolationType: string = '';
  selectedSeverity: string = '';
  selectedStatus: string = '';
  showTooltip: string = '';
  
  // User search
  allUsers: any[] = [];
  filteredUsers: any[] = [];
  userSearchTerm: string = '';
  showUserDropdown: boolean = false;
  userViolationCounts: Map<string, number> = new Map();

  // Task modal
  showTaskModal: boolean = false;
  selectedTask: any = null;
  loadingTask: boolean = false;

  violationColumns: TableColumn[] = [
    { key: 'user.name', label: 'User', sortable: true },
    { key: 'violationType', label: 'Type', sortable: true },
    { key: 'description', label: 'Details', sortable: false },
    { key: 'severity', label: 'Severity', sortable: true },
    { key: 'detectedOn', label: 'Detected On', sortable: true },
    { key: 'status', label: 'Status', sortable: true }
  ];

  constructor(
    private complianceService: ComplianceService,
    private issuesService: IssuesService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Check for query params to filter by violation type
    this.route.queryParams.subscribe(params => {
      if (params['type']) {
        this.selectedViolationType = params['type'];
      }
    });
    
    this.loadAllUsers();
    this.loadViolationCounts();
    this.loadViolations();
    
    // Close user dropdown when clicking outside
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-search-wrapper')) {
        this.showUserDropdown = false;
      }
    });
  }

  loadAllUsers() {
    this.complianceService.getAllUsers().subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.allUsers = data.data.map((user: any) => ({
            ...user,
            violationCount: this.userViolationCounts.get(user.id) || 0
          }));
          this.filterUsers();
        }
      },
      error: (error) => {
        console.error('Error loading users:', error);
      }
    });
  }

  loadViolationCounts() {
    // Load violations to get user violation counts
    this.complianceService.getViolations(1, 1000).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          // Count violations per user
          data.data.forEach((violation: any) => {
            if (violation.user) {
              const userId = violation.user.id;
              const currentCount = this.userViolationCounts.get(userId) || 0;
              this.userViolationCounts.set(userId, currentCount + 1);
            }
          });
          
          // Update user violation counts
          this.allUsers = this.allUsers.map(user => ({
            ...user,
            violationCount: this.userViolationCounts.get(user.id) || 0
          }));
          this.filterUsers();
        }
      },
      error: (error) => {
        console.error('Error loading violation counts:', error);
      }
    });
  }

  filterUsers() {
    if (!this.userSearchTerm.trim()) {
      this.filteredUsers = [...this.allUsers].sort((a, b) => {
        // Sort by violation count (highest first), then alphabetically
        if (b.violationCount !== a.violationCount) {
          return b.violationCount - a.violationCount;
        }
        return a.name.localeCompare(b.name);
      }).slice(0, 10); // Show top 10 when no search
      return;
    }

    const searchTerm = this.userSearchTerm.toLowerCase();
    this.filteredUsers = this.allUsers
      .filter(user => 
        user.name.toLowerCase().includes(searchTerm) ||
        (user.email && user.email.toLowerCase().includes(searchTerm))
      )
      .sort((a, b) => {
        // Sort by violation count (highest first), then alphabetically
        if (b.violationCount !== a.violationCount) {
          return b.violationCount - a.violationCount;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, 20); // Limit to 20 results
  }

  selectUser(user: any) {
    this.selectedUser = user;
    this.selectedUserId = user.id;
    this.userSearchTerm = user.name;
    this.showUserDropdown = false;
    this.applyFilters();
  }

  clearUserFilter() {
    this.selectedUser = null;
    this.selectedUserId = '';
    this.userSearchTerm = '';
    this.showUserDropdown = false;
    this.filterUsers();
    this.applyFilters();
  }

  loadViolations(page: number = 1) {
    this.loading = true;
    this.currentPage = page;
    this.complianceService.getViolations(
      page, 
      this.pageSize,
      this.selectedViolationType || undefined,
      this.selectedSeverity || undefined,
      this.selectedStatus || undefined,
      this.selectedUserId || undefined
    ).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.violations = (data.data || []).map((violation: any) => ({
            ...violation,
            date: new Date(violation.date).toLocaleDateString(),
            detectedOn: new Date(violation.createdAt).toLocaleDateString(),
            violationTypeFormatted: this.formatViolationType(violation.violationType),
            severityBadge: this.getSeverityBadge(violation.severity),
            statusBadge: this.getStatusBadge(violation.status),
            description: this.getViolationDescription(violation)
          }));
          this.totalItems = data.pagination?.total || data.total || 0;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading violations:', error);
        this.loading = false;
      }
    });
  }

  applyFilters() {
    this.currentPage = 1;
    this.loadViolations(1);
  }

  clearFilters() {
    this.clearUserFilter();
    this.selectedViolationType = '';
    this.selectedSeverity = '';
    this.selectedStatus = '';
    this.applyFilters();
  }

  onPageChange(page: number) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.loadViolations(page);
  }

  formatViolationType(type: string): string {
    const types: { [key: string]: string } = {
      'missing_entry': 'Missing Entry',
      'late_entry': 'Late Entry',
      'bulk_logging': 'Bulk Logging',
      'round_numbers': 'Round Numbers',
      'stale_task': 'Stale Task',
      'overrun_task': 'Overrun Task',
      'partial_entry': 'Partial Entry'
    };
    return types[type] || type;
  }

  getSeverityBadge(severity: string): { text: string; class: string } {
    const badges: { [key: string]: { text: string; class: string } } = {
      'high': { text: 'High', class: 'badge-severity-high' },
      'medium': { text: 'Medium', class: 'badge-severity-medium' },
      'low': { text: 'Low', class: 'badge-severity-low' }
    };
    return badges[severity] || { text: severity, class: 'badge-severity-medium' };
  }

  getStatusBadge(status: string): { text: string; class: string } {
    const badges: { [key: string]: { text: string; class: string } } = {
      'open': { text: 'Open', class: 'badge-status-open' },
      'resolved': { text: 'Resolved', class: 'badge-status-resolved' },
      'ignored': { text: 'Ignored', class: 'badge-status-ignored' }
    };
    return badges[status] || { text: status, class: 'badge-status-open' };
  }

  getViolationDescription(violation: any): string {
    const metadata = violation.metadata || {};
    
    switch (violation.violationType) {
      case 'missing_entry':
        return `No time entries logged in last 7 days`;
      
      case 'late_entry': {
        const daysLate = metadata.daysLate || 0;
        const workDate = metadata.spentOn ? new Date(metadata.spentOn).toLocaleDateString() : '';
        return `Entry logged ${daysLate} days late (work done: ${workDate})`;
      }
      
      case 'bulk_logging': {
        const entriesCount = metadata.entriesCount || 0;
        const daysSpanned = metadata.daysSpanned || 0;
        return `${entriesCount} entries created at once, spanning ${daysSpanned} days`;
      }
      
      case 'round_numbers': {
        const roundCount = metadata.roundNumberEntries || 0;
        return `${roundCount} round number entries in last 7 days`;
      }
      
      case 'stale_task': {
        const issueSubject = metadata.issueSubject || 'Unknown task';
        return `Task: "${issueSubject.substring(0, 50)}${issueSubject.length > 50 ? '...' : ''}" - No activity in 14 days`;
      }
      
      case 'overrun_task': {
        const estimated = metadata.estimatedHours || 0;
        const spent = metadata.spentHours || 0;
        const overrunPct = metadata.overrunPercentage || 0;
        const taskSubject = metadata.issueSubject || 'Unknown task';
        return `Task: "${taskSubject.substring(0, 40)}${taskSubject.length > 40 ? '...' : ''}" - Spent ${spent.toFixed(1)}h vs ${estimated.toFixed(1)}h estimated (+${overrunPct}%)`;
      }
      
      case 'partial_entry': {
        const hours = metadata.hours || 0;
        const projectName = metadata.projectName || null;
        const issueSubject = metadata.issueSubject || null;
        const weekStart = metadata.weekStart ? new Date(metadata.weekStart).toLocaleDateString() : '';
        
        if (issueSubject && projectName) {
          return `${issueSubject.substring(0, 40)}${issueSubject.length > 40 ? '...' : ''} (${projectName}) - ${hours.toFixed(2)}h/week${weekStart ? ` (Week of ${weekStart})` : ''}`;
        } else if (projectName) {
          return `${projectName} - ${hours.toFixed(2)}h/week${weekStart ? ` (Week of ${weekStart})` : ''}`;
        } else {
          return `${hours.toFixed(2)} hours/week${weekStart ? ` (Week of ${weekStart})` : ''}`;
        }
      }
      
      default:
        // Check if violation has a description field (for on-the-fly calculated violations)
        if (violation.description) {
          return violation.description;
        }
        return 'Compliance violation detected';
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }

  onViolationClick(violation: any) {
    // Only open modal for stale_task and overrun_task violations
    if (violation.violationType === 'stale_task' || violation.violationType === 'overrun_task') {
      const issueId = violation.metadata?.issueId;
      if (issueId) {
        this.openTaskModal(issueId);
      }
    }
  }

  openTaskModal(issueId: string) {
    this.showTaskModal = true;
    this.loadingTask = true;
    this.selectedTask = null;

    this.issuesService.getIssueDetails(issueId).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.selectedTask = data.data;
        }
        this.loadingTask = false;
      },
      error: (error) => {
        console.error('Error loading task details:', error);
        this.loadingTask = false;
        alert('Error loading task details: ' + (error.error?.message || error.message));
      }
    });
  }

  closeTaskModal() {
    this.showTaskModal = false;
    this.selectedTask = null;
    this.loadingTask = false;
  }

  formatDate(date: string | Date | null | undefined): string {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString();
    } catch (error) {
      return 'N/A';
    }
  }
}

