import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { StatCardComponent } from '../shared/stat-card/stat-card.component';
import { ChartComponent } from '../shared/chart/chart.component';
import { DataTableComponent, TableColumn } from '../shared/data-table/data-table.component';
import { ComplianceService } from '../../services/compliance.service';
import { ProjectsService } from '../../services/projects.service';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NavbarComponent, StatCardComponent, ChartComponent, DataTableComponent],
  template: `
    <app-navbar></app-navbar>
    
    <div class="dashboard-container">
      <!-- Welcome Message for Managers -->
      <div *ngIf="isManager && currentUser" class="section welcome-section">
        <h1 class="welcome-title">Welcome, {{ currentUser.name }}!</h1>
        <p class="welcome-subtitle">Manager Dashboard - View your team's compliance and project status</p>
      </div>

      <!-- System Overview - Compact at Top -->
      <div class="section system-overview-section">
        <h2 class="section-title-small">{{ isManager ? 'My Team Overview' : 'System Overview' }}</h2>
        <div class="stats-compact-small">
          <div class="stat-item-small" (click)="navigateToProjects()">
            <div class="stat-icon-small" style="background-color: rgba(139, 92, 246, 0.1);">
              <span style="color: #8B5CF6;">📁</span>
            </div>
            <div class="stat-content-small">
              <div class="stat-value-small">{{ overview.totalProjects || 0 }}</div>
              <div class="stat-label-small">Projects</div>
            </div>
          </div>
          
          <div class="stat-item-small" (click)="navigateToIssues()">
            <div class="stat-icon-small" style="background-color: rgba(236, 72, 153, 0.1);">
              <span style="color: #EC4899;">📋</span>
            </div>
            <div class="stat-content-small">
              <div class="stat-value-small">{{ overview.totalIssues || 0 }}</div>
              <div class="stat-label-small">Issues</div>
            </div>
          </div>
          
          <div class="stat-item-small" (click)="navigateToIssues()">
            <div class="stat-icon-small" style="background-color: rgba(20, 184, 166, 0.1);">
              <span style="color: #14B8A6;">⏱️</span>
            </div>
            <div class="stat-content-small">
              <div class="stat-value-small">{{ formatNumber(overview.totalTimeEntries || 0) }}</div>
              <div class="stat-label-small">Time Entries</div>
            </div>
          </div>
          
          <!-- Users count - Only visible for admins -->
          <div class="stat-item-small" *ngIf="isAdmin" (click)="navigateToUsers()">
            <div class="stat-icon-small" style="background-color: rgba(59, 130, 246, 0.1);">
              <span style="color: #3B82F6;">👥</span>
            </div>
            <div class="stat-content-small">
              <div class="stat-value-small">{{ overview.totalUsers || 0 }}</div>
              <div class="stat-label-small">Users</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Compliance Metrics Section -->
      <div class="section">
        <h2 class="section-title-small">Compliance Metrics</h2>
        <div class="stats-grid">
        <!-- Compliance Rate - Hidden for managers -->
        <app-stat-card
          *ngIf="!isManager"
          label="Compliance Rate"
          [value]="overview.complianceRate + '%'"
          [change]="null"
          [clickable]="isAdmin"
          [description]="'Percentage of users who logged time entries in the last 7 days'"
          (cardClick)="navigateToUsers('lowCompliance')"
          iconColor="#4F46E5">
        </app-stat-card>
        
        <!-- Missing Entries - Hidden for managers -->
        <app-stat-card
          *ngIf="!isManager"
          label="Missing Entries"
          [value]="overview.missingEntries"
          [change]="null"
          [clickable]="isAdmin"
          [description]="'Users who have not logged any time entries in the last ' + missingEntryDays + ' days'"
          (cardClick)="navigateToUsers('missingEntries')"
          iconColor="#EF4444">
        </app-stat-card>
        
        <app-stat-card
          label="Tasks Overrun"
          [value]="overview.tasksOverrun"
          [change]="null"
          [clickable]="true"
          [description]="'Tasks where spent hours exceed ' + overrunPercentage + '% of estimated hours'"
          (cardClick)="navigateToIssues('overrun')"
          iconColor="#F59E0B">
        </app-stat-card>
        
        <app-stat-card
          label="PMs Flagged"
          [value]="overview.pmsFlagged"
          [change]="null"
          [clickable]="true"
          [description]="'Managers whose team members have open compliance violations'"
          (cardClick)="navigateToAnalytics()"
          iconColor="#10B981">
          </app-stat-card>
        
        <app-stat-card
          label="Late Entries"
          [value]="overview.lateEntryViolations || 0"
          [change]="null"
          [clickable]="true"
          [description]="'Time entries logged more than ' + lateEntryDays + ' days after work was completed'"
          (cardClick)="navigateToViolations('late_entry')"
          iconColor="#9333EA">
        </app-stat-card>
        
          <app-stat-card
          label="Partial Entries"
          [value]="overview.partialEntries || 0"
          [description]="'Weekly totals less than 40 hours (5 working days) per user and project/issue'"
          [change]="null"
          [clickable]="true"
          [description]="'Time entries with less than 8 hours logged in the last 7 days'"
          (cardClick)="navigateToViolations('partial_entry')"
          iconColor="#06B6D4">
        </app-stat-card>
        </div>
      </div>

      <!-- Additional Metrics Section -->
      <div class="section">
        <h2 class="section-title-small">Additional Metrics</h2>
        <div class="stats-grid">
        <app-stat-card
          label="Open Violations"
          [value]="overview.totalViolations || 0"
          [change]="null"
          [clickable]="true"
          [description]="'Total number of unresolved compliance violations (run compliance check to detect)'"
          (cardClick)="navigateToViolations()"
          iconColor="#F43F5E">
        </app-stat-card>
        
        <app-stat-card
          label="Issues Without Estimates"
          [value]="overview.issuesWithoutEstimates || 0"
          [change]="null"
          [clickable]="true"
          [description]="'Issues/tasks that have no estimated hours or zero estimates'"
          (cardClick)="navigateToIssues('withoutEstimates')"
          iconColor="#F59E0B">
        </app-stat-card>
        
        <app-stat-card
          label="Projects with Issues"
          [value]="overview.projectsWithIssuesWithoutEstimates || 0"
          [change]="null"
          [clickable]="true"
          [description]="'Projects that have issues without time estimates'"
          (cardClick)="navigateToProjects('issuesWithoutEstimates')"
          iconColor="#EC4899">
          </app-stat-card>
        
        <app-stat-card
          label="Stale Tasks"
          [value]="overview.staleTaskViolations || 0"
          [change]="null"
          [clickable]="true"
          [description]="'Tasks with no time entries in the last ' + staleTaskDays + ' days (compliance violations)'"
          (cardClick)="navigateToViolations()"
          iconColor="#8B5CF6">
        </app-stat-card>
        </div>
      </div>

      <!-- Action Required Section -->
      <div class="section">
        <h2 class="section-title-small">Action Required</h2>
        <div class="action-items">
          <div class="action-item" *ngIf="overview.totalViolations === 0">
            <div class="action-icon" [style.background-color]="'#4F46E5' + '20'">
              <span [style.color]="'#4F46E5'">ℹ️</span>
            </div>
            <div class="action-content">
              <div class="action-title">Run Compliance Check</div>
              <div class="action-description">No violations detected yet. Click the button below to run compliance checks and detect violations.</div>
              <button class="btn-run-check" (click)="runComplianceCheck()">Run Compliance Check</button>
            </div>
          </div>
          <div class="action-item" *ngFor="let item of actionItems">
            <div class="action-icon" [style.background-color]="item.color + '20'">
              <span [style.color]="item.color">●</span>
            </div>
            <div class="action-content">
              <div class="action-title">{{ item.title }}</div>
              <div class="action-description">{{ item.description }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Compliance Trends Chart -->
      <div class="section">
        <h2 class="section-title-small">{{ isManager ? 'Team Compliance Trends' : 'Compliance Trends' }}</h2>
        <div class="chart-card">
          <app-chart
            type="line"
            [data]="trendsChartData"
            [options]="chartOptions">
          </app-chart>
        </div>
      </div>

      <!-- Team Status Section - Hidden for managers -->
      <div class="section" *ngIf="!isManager">
        <h2 class="section-title-small">Team Status</h2>
        <div class="team-status">
          <div class="status-item" *ngFor="let status of teamStatus">
            <div class="status-indicator" [class.active]="status.logged"></div>
            <div class="status-info">
              <div class="status-name">{{ status.name }}</div>
              <div class="status-time">{{ status.time }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Project Health Section -->
      <div class="section">
        <h2 class="section-title-small">{{ isManager ? 'My Projects Health' : 'Project Health' }}</h2>
        
        <!-- Health View Tabs -->
        <div class="health-tabs">
          <button 
            *ngFor="let view of healthViews" 
            [class.active]="activeHealthView === view.id"
            (click)="switchHealthView(view.id)"
            class="health-tab">
            <span class="tab-icon">{{ view.icon }}</span>
            <span class="tab-label">{{ view.label }}</span>
            <span class="tab-count" *ngIf="view.count !== undefined">{{ view.count }}</span>
          </button>
        </div>

        <!-- Health View Content -->
        <div class="health-content">
          <!-- View 1: Projects with Issues Without Estimates -->
          <div *ngIf="activeHealthView === 'noEstimates'" class="health-view">
            <div class="health-header">
              <h3 class="health-title">Projects with Issues Without Estimates</h3>
              <p class="health-description">Projects that have issues/tasks without time estimates</p>
            </div>
            <app-data-table
              [columns]="projectHealthColumns"
              [data]="projectsNoEstimates"
              [showSearch]="true"
              [paginated]="true"
              [pageSize]="10"
              [clickableRows]="true"
              (rowClick)="navigateToProjectIssues($event, 'withoutEstimates')">
            </app-data-table>
          </div>

          <!-- View 2: Projects with Long-Running Tasks -->
          <div *ngIf="activeHealthView === 'staleTasks'" class="health-view">
            <div class="health-header">
              <h3 class="health-title">Projects with Long-Running Tasks</h3>
              <p class="health-description">Projects with open tasks created more than {{ staleTaskMonths }} months ago</p>
            </div>
            <app-data-table
              [columns]="staleTasksColumns"
              [data]="projectsStaleTasks"
              [showSearch]="true"
              [paginated]="true"
              [pageSize]="10"
              [clickableRows]="true"
              (rowClick)="navigateToProjectIssues($event)">
            </app-data-table>
          </div>

          <!-- View 3: Projects with High Spent Hours -->
          <div *ngIf="activeHealthView === 'highSpent'" class="health-view">
            <div class="health-header">
              <h3 class="health-title">Projects with High Spent Hours</h3>
              <p class="health-description">Projects with tasks that have spent more than {{ maxSpentHours }} hours (total effort from issue creation)</p>
            </div>
            <app-data-table
              [columns]="highSpentColumns"
              [data]="projectsHighSpent"
              [showSearch]="true"
              [paginated]="true"
              [pageSize]="10"
              [clickableRows]="true"
              (rowClick)="navigateToProjectIssues($event)">
            </app-data-table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .hero-section {
      margin-bottom: 3rem;
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

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    .system-overview-section {
      margin-bottom: 2rem;
    }

    .section-title-small {
      font-family: 'Sora', sans-serif;
      font-size: 1rem;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stats-compact-small {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.75rem;
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1rem;
    }

    .stat-item-small {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      border-radius: 4px;
      transition: background-color 0.2s;
      cursor: pointer;
    }

    .stat-item-small:hover {
      background-color: var(--bg-secondary);
    }

    .stat-icon-small {
      width: 2rem;
      height: 2rem;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .stat-icon-small span {
      font-size: 1rem;
    }

    .stat-content-small {
      flex: 1;
      min-width: 0;
    }

    .stat-value-small {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.125rem;
    }

    .stat-label-small {
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-weight: 400;
    }

    .section {
      margin-bottom: 3rem;
    }

    .section-title {
      font-family: 'Sora', sans-serif;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 1.5rem;
    }

    .action-items {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .action-item {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }

    .action-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .action-icon span {
      font-size: 1rem;
    }

    .action-content {
      flex: 1;
    }

    .action-title {
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
    }

    .action-description {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }

    .btn-run-check {
      margin-top: 0.75rem;
      padding: 0.5rem 1rem;
      background-color: var(--primary);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .btn-run-check:hover {
      background-color: var(--primary-dark);
    }

    .team-status {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 0;
      border-bottom: 1px solid var(--border);
    }

    .status-item:last-child {
      border-bottom: none;
    }

    .status-indicator {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 50%;
      background-color: var(--text-tertiary);
    }

    .status-indicator.active {
      background-color: var(--success);
    }

    .status-info {
      flex: 1;
    }

    .status-name {
      color: var(--text-primary);
      font-weight: 500;
      margin-bottom: 0.25rem;
    }

    .status-time {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .chart-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      height: 400px;
    }

    .health-tabs {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }

    .health-tab {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .health-tab:hover {
      background-color: var(--bg-secondary);
      border-color: var(--primary);
    }

    .health-tab.active {
      background-color: var(--primary);
      border-color: var(--primary);
      color: white;
    }

    .tab-icon {
      font-size: 1.125rem;
    }

    .tab-label {
      flex: 1;
    }

    .tab-count {
      background-color: rgba(255, 255, 255, 0.2);
      padding: 0.125rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .health-tab.active .tab-count {
      background-color: rgba(255, 255, 255, 0.3);
    }

    .health-content {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
    }

    .health-view {
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .health-header {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }

    .health-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
    }

    .health-description {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin: 0;
    }

    .welcome-section {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      color: white;
    }

    .welcome-title {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .welcome-subtitle {
      font-size: 1rem;
      opacity: 0.9;
      margin: 0;
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private subscriptions: Subscription[] = [];

  overview = {
    complianceRate: 0,
    missingEntries: 0,
    tasksOverrun: 0,
    lateEntryViolations: 0,
    partialEntries: 0,
    pmsFlagged: 0,
    totalUsers: 0,
    totalProjects: 0,
    totalIssues: 0,
    totalTimeEntries: 0,
    totalViolations: 0,
    staleTaskViolations: 0,
    issuesWithoutEstimates: 0,
    projectsWithIssuesWithoutEstimates: 0,
    flaggedPMsCount: 0,
    projectsWithStaleTasks: 0
  };

  actionItems: any[] = [];
  teamStatus: any[] = [];
  trendsChartData: any = {
    labels: [],
    datasets: [{
      label: 'Compliance Rate',
      data: [],
      borderColor: '#4F46E5',
      backgroundColor: 'rgba(79, 70, 229, 0.2)',
      tension: 0.4
    }]
  };

  chartOptions = {
    responsive: true,
    maintainAspectRatio: false
  };

  projectColumns: TableColumn[] = [
    { key: 'name', label: 'Project Name', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'compliance', label: 'Compliance', sortable: true },
    { key: 'issues', label: 'Issues', sortable: true },
    { key: 'overruns', label: 'Overruns', sortable: true }
  ];

  projectHealthData: any[] = [];
  activeHealthView: string = 'noEstimates';
  staleTaskMonths: number = 2;
  staleTaskDays: number = 10; // For stale task violations (no activity)
  lateEntryDays: number = 3; // For late entry violations (days late threshold)
  missingEntryDays: number = 7; // For missing entry violations (days without entries)
  maxSpentHours: number = 350;
  overrunPercentage: number = 150; // Default, will be loaded from config

  healthViews: any[] = [
    { id: 'noEstimates', label: 'No Estimates', icon: '📋', count: 0 },
    { id: 'staleTasks', label: 'Long-Running Tasks', icon: '⏰', count: 0 },
    { id: 'highSpent', label: 'High Spent Hours', icon: '💰', count: 0 }
  ];

  projectsNoEstimates: any[] = [];
  projectsStaleTasks: any[] = [];
  projectsHighSpent: any[] = [];

  projectHealthColumns: TableColumn[] = [
    { key: 'name', label: 'Project Name', sortable: true },
    { key: 'manager.name', label: 'Manager', sortable: true },
    { key: 'issuesWithoutEstimates', label: 'Issues Without Estimates', sortable: true },
    { key: '_count.issues', label: 'Total Issues', sortable: true }
  ];

  staleTasksColumns: TableColumn[] = [
    { key: 'name', label: 'Project Name', sortable: true },
    { key: 'manager.name', label: 'Manager', sortable: true },
    { key: 'staleTasksCount', label: 'Stale Tasks', sortable: true },
    { key: 'oldestStaleTask', label: 'Oldest Task', sortable: true }
  ];

  highSpentColumns: TableColumn[] = [
    { key: 'name', label: 'Project Name', sortable: true },
    { key: 'manager.name', label: 'Manager', sortable: true },
    { key: 'highSpentIssuesCount', label: 'High Spent Issues', sortable: true },
    { key: 'maxSpentHours', label: 'Max Spent (h)', sortable: true }
  ];

  currentUser: any = null;
  isManager: boolean = false;
  isAdmin: boolean = false;

  constructor(
    private complianceService: ComplianceService,
    private projectsService: ProjectsService,
    private configService: ConfigService,
    private router: Router,
    private authService: AuthService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.subscriptions.push(
      this.configService.getComplianceRules().subscribe({
        next: (data: any) => {
          if (data.success && data.data) {
            const threshold = data.data.overrunThreshold || 150;
            this.overrunPercentage = threshold < 10 ? Math.round(threshold * 100) : threshold;
            this.staleTaskDays = data.data.staleTaskDays || 10;
            this.lateEntryDays = data.data.lateEntryDays || 3;
            this.missingEntryDays = data.data.missingEntryDays || 7;
          }
        },
        error: (error) => {
          console.error('Error loading config:', error);
          this.overrunPercentage = 150;
          this.staleTaskDays = 10;
          this.lateEntryDays = 3;
          this.missingEntryDays = 7;
        }
      })
    );

    this.subscriptions.push(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        this.isManager = this.authService.isManager();
        this.isAdmin = this.authService.isAdmin();
        
        if (this.isManager) {
          this.loadManagerOverview();
          this.loadManagerProjects();
        } else {
          this.loadOverview();
          this.loadTeamStatus();
          this.loadProjectHealth();
        }
        
        this.loadTrends();
        this.loadActionItems();
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  loadOverview() {
    const sub = this.complianceService.getOverview().subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.overview = { ...this.overview, ...data.data };
          this.updateActionItems();
        }
      },
      error: (error) => {
        console.error('Error loading overview:', error);
      }
    });
    this.subscriptions.push(sub);
  }

  loadTrends() {
    const sub = this.complianceService.getTrends(7).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.trendsChartData = {
            labels: data.data.map((d: any) => {
              const date = new Date(d.date);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: [{
              label: 'Compliance Rate',
              data: data.data.map((d: any) => d.compliance),
              borderColor: '#4F46E5',
              backgroundColor: 'rgba(79, 70, 229, 0.2)',
              tension: 0.4
            }]
          };
        }
      },
      error: (error) => {
        console.error('Error loading trends:', error);
      }
    });
    this.subscriptions.push(sub);
  }

  updateActionItems() {
    this.actionItems = [];
    
    if (this.overview.missingEntries > 0) {
      this.actionItems.push({
        title: `${this.overview.missingEntries} users with missing time entries`,
        description: 'Action required: Review and follow up with team members',
        color: '#EF4444'
      });
    }

    if (this.overview.tasksOverrun > 0) {
      this.actionItems.push({
        title: `${this.overview.tasksOverrun} tasks exceeding estimates`,
        description: 'Projects need attention: Review project timelines',
        color: '#F59E0B'
      });
    }

    if (this.overview.pmsFlagged > 0) {
      this.actionItems.push({
        title: `${this.overview.pmsFlagged} managers with flagged teams`,
        description: 'Manager attention required: Review team compliance',
        color: '#F59E0B'
      });
    }

    if (this.actionItems.length === 0) {
      this.actionItems.push({
        title: 'All systems operational',
        description: 'No action items at this time',
        color: '#10B981'
      });
    }
  }

  loadActionItems() {
    // Action items are updated from overview data
  }

  loadTeamStatus() {
    // Load team status from users API
    const sub = this.complianceService.getAllUsers().subscribe({
      next: (data: any) => {
        if (data.success && data.data && Array.isArray(data.data)) {
          // Get users with their last time entry
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          this.teamStatus = data.data
            .slice(0, 10) // Limit to 10 users for display
            .map((user: any) => {
              // Check if user has recent time entries (timeEntries array from backend)
              const hasRecentEntries = user.timeEntries && user.timeEntries.length > 0;
              
              // Get last time entry date
              let lastEntryDate = null;
              let timeText = 'No recent entries';
              
              if (hasRecentEntries && user.timeEntries[0]) {
                lastEntryDate = new Date(user.timeEntries[0].spentOn);
                const daysAgo = Math.floor((new Date().getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysAgo === 0) {
                  timeText = 'Today';
                } else if (daysAgo === 1) {
                  timeText = 'Yesterday';
                } else if (daysAgo < 7) {
                  timeText = `${daysAgo} days ago`;
                } else {
                  timeText = lastEntryDate.toLocaleDateString();
                }
              }
              
              return {
                name: user.name || 'Unknown User',
                time: timeText,
                logged: hasRecentEntries || false
              };
            });
          
          // If no users found, show empty state
          if (this.teamStatus.length === 0) {
            this.teamStatus = [
              { name: 'No active users', time: 'No data available', logged: false }
            ];
          }
        } else {
          this.teamStatus = [
            { name: 'No data available', time: 'Unable to load team status', logged: false }
          ];
        }
      },
      error: (error) => {
        console.error('Error loading team status:', error);
        this.teamStatus = [
          { name: 'Error loading data', time: 'Please try again later', logged: false }
        ];
      }
    });
  }

  loadProjectHealth() {
    // Load configuration first
    const sub = this.configService.getComplianceRules().subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.staleTaskMonths = data.data.staleTaskMonths || 2;
          this.maxSpentHours = data.data.maxSpentHours || 350;
          // Handle backward compatibility: if value < 10, it's old format (multiplier), convert to percentage
          const threshold = data.data.overrunThreshold || 150;
          this.overrunPercentage = threshold < 10 ? Math.round(threshold * 100) : threshold;
        }
        // Load all health views
        this.loadProjectsNoEstimates();
        this.loadProjectsStaleTasks();
        this.loadProjectsHighSpent();
      },
      error: (error) => {
        console.error('Error loading config:', error);
        // Load with defaults
        this.loadProjectsNoEstimates();
        this.loadProjectsStaleTasks();
        this.loadProjectsHighSpent();
      }
    });
    this.subscriptions.push(sub);
  }

  loadProjectsNoEstimates() {
    const sub = this.projectsService.getProjects(1, 10, undefined, 'issuesWithoutEstimates').subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.projectsNoEstimates = data.data.map((project: any) => ({
            ...project,
            'manager.name': project.manager?.name || 'N/A',
            issuesWithoutEstimates: project.issuesWithoutEstimates || 0
          }));
          this.healthViews[0].count = data.pagination?.total || 0;
        }
      },
      error: (error) => {
        console.error('Error loading projects without estimates:', error);
      }
    });
    this.subscriptions.push(sub);
  }

  loadProjectsStaleTasks() {
    const sub = this.projectsService.getProjectsWithStaleTasks(1, 10).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.projectsStaleTasks = data.data.map((project: any) => ({
            ...project,
            'manager.name': project.manager?.name || 'N/A',
            oldestStaleTask: project.oldestStaleTask 
              ? new Date(project.oldestStaleTask).toLocaleDateString()
              : 'N/A',
            staleTasksCount: project.staleTasksCount || 0
          }));
          this.healthViews[1].count = data.pagination?.total || 0;
        } else {
          this.projectsStaleTasks = [];
          this.healthViews[1].count = 0;
        }
      },
      error: (error) => {
        console.error('Error loading stale tasks:', error);
        this.projectsStaleTasks = [];
        this.healthViews[1].count = 0;
      }
    });
    this.subscriptions.push(sub);
  }

  loadProjectsHighSpent() {
    const sub = this.projectsService.getProjectsWithHighSpentHours(1, 10).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.projectsHighSpent = data.data.map((project: any) => ({
            ...project,
            'manager.name': project.manager?.name || 'N/A',
            maxSpentHours: project.maxSpentHours ? project.maxSpentHours.toFixed(1) : 'N/A'
          }));
          this.healthViews[2].count = data.pagination?.total || 0;
        }
      },
      error: (error) => {
        console.error('Error loading high spent projects:', error);
      }
    });
  }

  switchToStaleTasksView() {
    this.activeHealthView = 'staleTasks';
    const sub = this.configService.getComplianceRules().subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.staleTaskMonths = data.data.staleTaskMonths || 2;
        }
        this.loadProjectsStaleTasks();
      },
      error: (error) => {
        console.error('Error loading config for stale tasks:', error);
        this.loadProjectsStaleTasks();
      }
    });
    this.subscriptions.push(sub);
  }

  switchHealthView(viewId: string) {
    this.activeHealthView = viewId;
    
    // Reload data when switching views to ensure we have the latest config values
    if (viewId === 'staleTasks') {
      // Reload config to get latest staleTaskMonths value, then reload stale tasks
      const sub = this.configService.getComplianceRules().subscribe({
        next: (data: any) => {
          if (data.success && data.data) {
            this.staleTaskMonths = data.data.staleTaskMonths || 2;
          }
          // Reload stale tasks data with latest config
          this.loadProjectsStaleTasks();
        },
        error: (error) => {
          console.error('Error loading config for stale tasks:', error);
          // Still reload stale tasks even if config load fails
          this.loadProjectsStaleTasks();
        }
      });
    } else if (viewId === 'highSpent') {
      // Reload config to get latest maxSpentHours value, then reload high spent
      const sub = this.configService.getComplianceRules().subscribe({
        next: (data: any) => {
          if (data.success && data.data) {
            this.maxSpentHours = data.data.maxSpentHours || 350;
          }
          // Reload high spent data with latest config
          this.loadProjectsHighSpent();
        },
        error: (error) => {
          console.error('Error loading config for high spent:', error);
          // Still reload high spent even if config load fails
          this.loadProjectsHighSpent();
        }
      });
      this.subscriptions.push(sub);
    }
  }

  navigateToProjectIssues(project: any, filter?: string) {
    if (project && project.id) {
      const queryParams: any = { projectId: project.id };
      if (filter) {
        queryParams.filter = filter;
      }
      this.router.navigate(['/issues'], { queryParams });
    }
  }

  navigateToUsers(filter?: string) {
    if (filter) {
      this.router.navigate(['/users'], { queryParams: { filter } });
    } else {
      this.router.navigate(['/users']);
    }
  }

  navigateToProjects(filter?: string) {
    if (filter) {
      this.router.navigate(['/projects'], { queryParams: { filter } });
    } else {
      this.router.navigate(['/projects']);
    }
  }

  navigateToIssues(filter?: string) {
    if (filter) {
      this.router.navigate(['/issues'], { queryParams: { filter } });
    } else {
      this.router.navigate(['/issues']);
    }
  }

  navigateToAnalytics() {
    this.router.navigate(['/analytics']);
  }

  navigateToViolations(violationType?: string) {
    if (violationType) {
      this.router.navigate(['/violations'], { queryParams: { type: violationType } });
    } else {
      this.router.navigate(['/violations']);
    }
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  runComplianceCheck() {
    const sub = this.complianceService.runComplianceCheck().subscribe({
      next: (data: any) => {
        if (data.success) {
          console.log('Compliance check started');
          alert('Compliance check started! It may take a few minutes. The page will refresh automatically.');
          // Reload overview after a delay
          setTimeout(() => {
            if (this.isManager) {
              this.loadManagerOverview();
            } else {
              this.loadOverview();
            }
          }, 5000);
        }
      },
      error: (error) => {
        console.error('Error running compliance check:', error);
        alert('Error starting compliance check: ' + (error.error?.message || error.message));
      }
    });
    this.subscriptions.push(sub);
  }

  // Manager-specific methods
  loadManagerOverview() {
    if (!this.currentUser?.id) return;
    
    // Load manager's team compliance data
    const sub = this.apiService.get(`/managers/${this.currentUser.id}/team`).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          const teamData = data.data;
          // Calculate manager-specific metrics
          this.overview = {
            ...this.overview,
            totalUsers: teamData.teamMembers?.length || 0,
            totalProjects: teamData.managedProjects?.length || 0,
            complianceRate: teamData.teamComplianceRate || 0,
            missingEntries: teamData.missingEntries || 0,
            tasksOverrun: teamData.tasksOverrun || 0,
            totalViolations: teamData.totalViolations || 0,
            issuesWithoutEstimates: teamData.issuesWithoutEstimates || 0
          };
          this.updateActionItems();
        }
      },
      error: (error) => {
        console.error('Error loading manager overview:', error);
        this.overview = {
          ...this.overview,
          totalUsers: 0,
          totalProjects: 0,
          complianceRate: 0,
          missingEntries: 0,
          tasksOverrun: 0,
          totalViolations: 0,
          issuesWithoutEstimates: 0
        };
        this.updateActionItems();
      }
    });
    this.subscriptions.push(sub);
  }

  loadManagerTeamStatus() {
    if (!this.currentUser?.id) return;
    
    const sub = this.apiService.get(`/managers/${this.currentUser.id}/team`).subscribe({
      next: (data: any) => {
        if (data.success && data.data?.teamMembers) {
          this.teamStatus = data.data.teamMembers.map((member: any) => {
            let timeText = 'No recent entries';
            let hasRecentEntries = false;
            
            if (member.lastTimeEntry) {
              const lastEntryDate = new Date(member.lastTimeEntry);
              const daysAgo = Math.floor((new Date().getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24));
              
              if (daysAgo === 0) {
                timeText = 'Today';
                hasRecentEntries = true;
              } else if (daysAgo === 1) {
                timeText = 'Yesterday';
                hasRecentEntries = true;
              } else if (daysAgo < 7) {
                timeText = `${daysAgo} days ago`;
                hasRecentEntries = true;
              } else {
                timeText = lastEntryDate.toLocaleDateString();
              }
            }
            
            return {
              name: member.name || 'Unknown',
              time: timeText,
              logged: member.hasRecentEntries || hasRecentEntries
            };
          });
          
          if (this.teamStatus.length === 0) {
            this.teamStatus = [
              { name: 'No team members', time: 'No data available', logged: false }
            ];
          }
        } else {
          this.teamStatus = [
            { name: 'No data available', time: 'Unable to load team status', logged: false }
          ];
        }
      },
      error: (error) => {
        console.error('Error loading manager team status:', error);
        this.teamStatus = [
          { name: 'Error loading data', time: 'Please try again later', logged: false }
        ];
      }
    });
  }

  loadManagerProjects() {
    if (!this.currentUser?.id) return;
    
    // Load projects managed by this manager
    this.projectsService.getProjects(1, 50).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          // Filter projects where current user is the manager
          const managerProjects = data.data.filter((project: any) => 
            project.manager?.id === this.currentUser.id
          );
          
          // Update project health views with manager's projects
          this.projectsNoEstimates = managerProjects
            .filter((p: any) => (p.issuesWithoutEstimates || 0) > 0)
            .map((project: any) => ({
              ...project,
              'manager.name': project.manager?.name || 'N/A',
              issuesWithoutEstimates: project.issuesWithoutEstimates || 0
            }));
          
          this.healthViews[0].count = this.projectsNoEstimates.length;
          
          const staleSub = this.projectsService.getProjectsWithStaleTasks(1, 50).subscribe({
            next: (staleData: any) => {
              if (staleData.success && staleData.data) {
                this.projectsStaleTasks = staleData.data
                  .filter((p: any) => p.manager?.id === this.currentUser.id)
                  .map((project: any) => ({
                    ...project,
                    'manager.name': project.manager?.name || 'N/A',
                    oldestStaleTask: project.oldestStaleTask 
                      ? new Date(project.oldestStaleTask).toLocaleDateString()
                      : 'N/A'
                  }));
                this.healthViews[1].count = this.projectsStaleTasks.length;
              }
            },
            error: (error) => console.error('Error loading stale tasks:', error)
          });
          this.subscriptions.push(staleSub);
          
          const highSpentSub = this.projectsService.getProjectsWithHighSpentHours(1, 50).subscribe({
            next: (highSpentData: any) => {
              if (highSpentData.success && highSpentData.data) {
                this.projectsHighSpent = highSpentData.data
                  .filter((p: any) => p.manager?.id === this.currentUser.id)
                  .map((project: any) => ({
                    ...project,
                    'manager.name': project.manager?.name || 'N/A',
                    maxSpentHours: project.maxSpentHours ? project.maxSpentHours.toFixed(1) : 'N/A'
                  }));
                this.healthViews[2].count = this.projectsHighSpent.length;
              }
            },
            error: (error) => console.error('Error loading high spent projects:', error)
          });
        }
      },
      error: (error) => {
        console.error('Error loading manager projects:', error);
      }
    });
  }
}
