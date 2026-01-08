import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { RedmineService } from '../../services/redmine.service';
import { ConfigService } from '../../services/config.service';
import { ProjectsService } from '../../services/projects.service';
import { ComplianceService } from '../../services/compliance.service';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule, NavbarComponent, FormsModule],
  template: `
    <app-navbar></app-navbar>
    <div class="configuration-container">

      <!-- Tabs -->
      <div class="config-tabs">
        <button 
          *ngFor="let tab of tabs" 
          [class.active]="activeTab === tab.id"
          (click)="activeTab = tab.id"
          class="config-tab">
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Tab 1: Health Check and Sync -->
        <div *ngIf="activeTab === 'sync'" class="tab-panel">
          <!-- Redmine Connection Status -->
          <div class="section">
            <h2 class="section-title-small">Connection Status</h2>
            <div class="config-card">
              <div class="status-row">
                <span class="label">Connection Status:</span>
                <span class="status" [class.connected]="connectionStatus.connected" [class.disconnected]="!connectionStatus.connected">
                  {{ connectionStatus.connected ? '✅ Connected' : '❌ Disconnected' }}
                </span>
              </div>
              <div class="status-row" *ngIf="connectionStatus.redmineUrl">
                <span class="label">Redmine URL:</span>
                <span class="value">{{ connectionStatus.redmineUrl }}</span>
              </div>
              <div class="status-row" *ngIf="connectionStatus.lastSyncTimes">
                <span class="label">Last Sync Times:</span>
                <div class="sync-times">
                  <div *ngFor="let sync of getSyncTimes()">
                    <strong>{{ sync.entity }}:</strong> {{ sync.time || 'Never' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sync Controls -->
          <div class="section">
            <h2 class="section-title-small">Data Synchronization</h2>
            <div class="config-card">
              <p class="section-description">Synchronize data from Redmine. Choose the appropriate sync type based on your needs.</p>
              
              <div class="sync-controls">
                <div class="sync-action-card">
                  <div class="sync-action-header">
                    <h3>Full Sync</h3>
                    <button class="btn btn-primary" (click)="confirmFullSync()" [disabled]="syncing">
                      {{ syncing ? 'Syncing...' : 'Start Full Sync' }}
                    </button>
                  </div>
                  <p class="sync-description">
                    Synchronizes all data from Redmine: users, projects, issues, and time entries (last 90 days). 
                    This is a comprehensive sync that updates all records with the latest data from Redmine. 
                    Use this for initial setup or when you need a complete data refresh. 
                    <strong>This may take several minutes depending on data volume.</strong>
                  </p>
                </div>

                <div class="sync-action-card">
                  <div class="sync-action-header">
                    <h3>Incremental Sync</h3>
                    <button class="btn btn-secondary" (click)="confirmIncrementalSync()" [disabled]="syncing">
                      {{ syncing ? 'Syncing...' : 'Start Incremental Sync' }}
                    </button>
                  </div>
                  <p class="sync-description">
                    Synchronizes only data that has been created or updated since the last sync. 
                    This is faster and recommended for regular updates. Only fetches new or modified records 
                    for users, projects, issues, and time entries. 
                    <strong>Use this for daily or hourly updates.</strong>
                  </p>
                </div>

                <div class="sync-action-card">
                  <div class="sync-action-header">
                    <h3>Sync Issues Only</h3>
                    <button class="btn btn-tertiary" (click)="confirmSyncIssues()" [disabled]="syncing">
                      {{ syncing ? 'Syncing...' : 'Sync Issues' }}
                    </button>
                  </div>
                  <p class="sync-description">
                    Synchronizes only issues/tasks from Redmine. Updates all issues with latest status, 
                    assignments, estimates, and timestamps. Useful when you need to refresh issue data 
                    without syncing other entities. <strong>This will update all issues in the system.</strong>
                  </p>
                </div>

                <div class="sync-action-card">
                  <div class="sync-action-header">
                    <h3>Sync Time Entries Only</h3>
                    <button class="btn btn-tertiary" (click)="confirmSyncTimeEntries()" [disabled]="syncing">
                      {{ syncing ? 'Syncing...' : 'Sync Time Entries' }}
                    </button>
                  </div>
                  <p class="sync-description">
                    Synchronizes only time entries from Redmine (last 90 days by default). 
                    Updates time tracking data for compliance monitoring. This is useful for refreshing 
                    time entry data without syncing other entities. 
                    <strong>This will update time entries from the last 90 days.</strong>
                  </p>
                </div>
              </div>

              <div class="sync-status" *ngIf="syncMessage">
                <p [class]="syncMessageType">{{ syncMessage }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Manager Assignment -->
        <div *ngIf="activeTab === 'managers'" class="tab-panel">
          <div class="section">
            <h2 class="section-title-small">Project Manager Assignment</h2>
            <div class="config-card">
              <p class="section-description">Assign managers to projects. Managers are selected from Redmine users synced to the system.</p>
          
          <div class="manager-assignment-controls">
            <div class="search-filter">
              <input 
                type="text" 
                class="search-input" 
                placeholder="Search projects..." 
                [(ngModel)]="projectSearchTerm"
                (input)="filterProjects()">
            </div>
          </div>

          <div class="projects-manager-list" *ngIf="!loadingProjects">
            <div class="project-manager-item" *ngFor="let project of filteredProjects">
              <div class="project-info">
                <div class="project-name">{{ project.name }}</div>
                <div class="project-meta">
                  <span class="project-id">ID: {{ project.redmineProjectId }}</span>
                  <span class="project-status" [class]="'status-' + project.status">{{ project.status }}</span>
                </div>
              </div>
              <div class="manager-select">
                <select 
                  [value]="project.managerId || ''"
                  (change)="onManagerChange(project, $event)"
                  class="manager-dropdown">
                  <option value="">No Manager</option>
                  <option *ngFor="let user of users" [value]="user.id">
                    {{ user.name }} ({{ user.email }})
                  </option>
                </select>
                <span class="save-status" *ngIf="project.saving">Saving...</span>
                <span class="save-status success" *ngIf="project.saved">✓ Saved</span>
              </div>
            </div>
            <div class="pagination-controls" *ngIf="totalProjects > pageSize">
              <button (click)="previousProjectsPage()" [disabled]="projectsCurrentPage === 1">Previous</button>
              <span>Page {{ projectsCurrentPage }} of {{ projectsTotalPages }}</span>
              <button (click)="nextProjectsPage()" [disabled]="projectsCurrentPage === projectsTotalPages">Next</button>
            </div>
          </div>

          <div class="loading-state" *ngIf="loadingProjects">
            <p>Loading projects...</p>
          </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Thresholds and Parameters -->
        <div *ngIf="activeTab === 'thresholds'" class="tab-panel">
          <!-- Info Section at Top -->
          <div class="section">
            <div class="info-card">
              <h3 class="info-title">ℹ️ About These Settings</h3>
              <p class="info-text">These thresholds control how the system detects compliance violations. Adjust them based on your organization's policies. Changes take effect immediately on the next compliance check.</p>
            </div>
          </div>

          <!-- Compliance Detection Thresholds -->
          <div class="section">
            <h2 class="section-title-small">Compliance Detection Thresholds</h2>
            <div class="thresholds-grid">
              <!-- Late Entry Detection -->
              <div class="threshold-card">
                <div class="threshold-header">
                  <h3 class="threshold-title">Late Entry Detection</h3>
                  <span class="threshold-badge" title="Flags entries created after work date">Medium Risk</span>
                </div>
                <p class="threshold-description">Detect time entries logged after the work was completed</p>
                <div class="threshold-logic">
                  <strong>Calculation:</strong> <code>daysLate = createdOn - spentOn</code><br>
                  <strong>Flag if:</strong> daysLate > Threshold<br>
                  <strong>Severity:</strong> High (>7 days) or Medium (threshold+1 to 7 days)
                </div>
                <div class="threshold-controls">
                  <div class="threshold-control">
                    <label class="threshold-label">Threshold (days)</label>
                    <input 
                      type="number" 
                      [ngModel]="complianceRules.lateEntryDays"
                      (ngModelChange)="onLateEntryDaysChange($event)"
                      (blur)="updateLateEntryDays()"
                      min="1"
                      max="30"
                      step="1"
                      class="threshold-input-field">
                    <span class="threshold-unit">days late</span>
                  </div>
                  <div class="threshold-control">
                    <label class="threshold-label">Check Window</label>
                    <input 
                      type="number" 
                      [ngModel]="complianceRules.lateEntryCheckDays"
                      (ngModelChange)="onLateEntryCheckDaysChange($event)"
                      (blur)="updateLateEntryCheckDays()"
                      min="1"
                      max="365"
                      step="1"
                      class="threshold-input-field">
                    <span class="threshold-unit">days</span>
                  </div>
                </div>
              </div>

              <!-- Overrun Task Detection -->
              <div class="threshold-card">
                <div class="threshold-header">
                  <h3 class="threshold-title">Task Overrun</h3>
                  <span class="threshold-badge" title="Flags tasks exceeding estimated hours">High Risk</span>
                </div>
                <p class="threshold-description">Detect tasks where spent hours exceed estimated hours</p>
                <div class="threshold-logic">
                  <strong>Calculation:</strong> <code>totalSpent > estimatedHours × (percentage / 100)</code><br>
                  <strong>Flag if:</strong> Condition is true (only for tasks with valid estimates)<br>
                  <strong>Severity:</strong> High (>200%) or Medium (150-200%)
                </div>
                <div class="threshold-controls">
                  <div class="threshold-control">
                    <label class="threshold-label">Threshold</label>
                    <input 
                      type="number" 
                      [(ngModel)]="overrunPercentageDisplay"
                      (blur)="updateOverrunThreshold()"
                      min="100"
                      max="1000"
                      step="1"
                      class="threshold-input-field">
                    <span class="threshold-unit">%</span>
                  </div>
                </div>
              </div>

              <!-- Missing Entry Detection -->
              <div class="threshold-card">
                <div class="threshold-header">
                  <h3 class="threshold-title">Missing Entries</h3>
                  <span class="threshold-badge" title="Flags users with no time entries">High Risk</span>
                </div>
                <p class="threshold-description">Detect users who haven't logged time entries</p>
                <div class="threshold-logic">
                  <strong>Calculation:</strong> Compare active users vs users with entries in time window<br>
                  <strong>Flag if:</strong> Active user has no entries in last X days<br>
                  <strong>Severity:</strong> High
                </div>
                <div class="threshold-controls">
                  <div class="threshold-control">
                    <label class="threshold-label">Time Window</label>
                    <input 
                      type="number" 
                      [ngModel]="complianceRules.missingEntryDays"
                      (ngModelChange)="onMissingEntryDaysChange($event)"
                      (blur)="updateMissingEntryDays()"
                      min="1"
                      max="30"
                      step="1"
                      class="threshold-input-field">
                    <span class="threshold-unit">days</span>
                  </div>
                </div>
              </div>

              <!-- Stale Task Detection -->
              <div class="threshold-card">
                <div class="threshold-header">
                  <h3 class="threshold-title">Stale Tasks</h3>
                  <span class="threshold-badge" title="Flags open tasks with no activity">Medium Risk</span>
                </div>
                <p class="threshold-description">Detect open tasks with no time entries</p>
                <div class="threshold-logic">
                  <strong>Calculation:</strong> Check open tasks with zero time entries in time window<br>
                  <strong>Flag if:</strong> Task is open AND no entries in last X days<br>
                  <strong>Severity:</strong> Medium (assigned to task assignee)
                </div>
                <div class="threshold-controls">
                  <div class="threshold-control">
                    <label class="threshold-label">Time Window</label>
                    <input 
                      type="number" 
                      [ngModel]="complianceRules.staleTaskDays"
                      (ngModelChange)="onStaleTaskDaysChange($event)"
                      (blur)="updateStaleTaskDays()"
                      min="1"
                      max="90"
                      step="1"
                      class="threshold-input-field">
                    <span class="threshold-unit">days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Project Health Thresholds -->
          <div class="section">
            <h2 class="section-title-small">Project Health Thresholds</h2>
            <div class="thresholds-grid">
              <!-- Stale Task Months -->
              <div class="threshold-card">
                <div class="threshold-header">
                  <h3 class="threshold-title">Long-Running Tasks</h3>
                  <span class="threshold-badge">Project Health</span>
                </div>
                <p class="threshold-description">Flag projects with tasks open for extended periods</p>
                <div class="threshold-logic">
                  <strong>Calculation:</strong> <code>taskAge = now - task.createdAt</code><br>
                  <strong>Flag if:</strong> Task is open AND taskAge > threshold months<br>
                  <strong>Use Case:</strong> Identify stagnant tasks in projects
                </div>
                <div class="threshold-controls">
                  <div class="threshold-control">
                    <label class="threshold-label">Threshold</label>
                    <input 
                      type="number" 
                      [ngModel]="complianceRules.staleTaskMonths"
                      (ngModelChange)="onStaleTaskMonthsChange($event)"
                      (blur)="updateStaleTaskMonths()"
                      min="1"
                      max="12"
                      step="1"
                      class="threshold-input-field">
                    <span class="threshold-unit">months</span>
                  </div>
                </div>
              </div>

              <!-- High Spent Hours -->
              <div class="threshold-card">
                <div class="threshold-header">
                  <h3 class="threshold-title">High Spent Hours</h3>
                  <span class="threshold-badge">Project Health</span>
                </div>
                <p class="threshold-description">Flag projects with tasks consuming excessive hours</p>
                <div class="threshold-logic">
                  <strong>Calculation:</strong> <code>totalSpentHours = SUM(all timeEntries.hours from issue creation)</code><br>
                  <strong>Flag if:</strong> Task has totalSpentHours > threshold<br>
                  <strong>Note:</strong> Includes ALL time entries from issue creation date, not just recent entries<br>
                  <strong>Use Case:</strong> Identify tasks needing re-estimation
                </div>
                <div class="threshold-controls">
                  <div class="threshold-control">
                    <label class="threshold-label">Threshold</label>
                    <input 
                      type="number" 
                      [ngModel]="complianceRules.maxSpentHours"
                      (ngModelChange)="onMaxSpentHoursChange($event)"
                      (blur)="updateMaxSpentHours()"
                      min="1"
                      max="10000"
                      step="10"
                      class="threshold-input-field">
                    <span class="threshold-unit">hours</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 4: AI Settings -->
        <div *ngIf="activeTab === 'ai'" class="tab-panel">
          <!-- Info Section -->
          <div class="section">
            <div class="info-card">
              <h3 class="info-title">🤖 AI Configuration</h3>
              <p class="info-text">Configure Claude AI settings including model, API key, and prompts for each AI feature. Changes take effect immediately.</p>
            </div>
          </div>

          <!-- AI Settings Form -->
          <div class="section">
            <h2 class="section-title-small">AI Service Settings</h2>
            <div class="config-card">
              <div class="ai-settings-form">
                <div class="form-group">
                  <label class="form-label">Model Name</label>
                  <input 
                    type="text" 
                    [(ngModel)]="aiSettings.model"
                    (blur)="updateAISettings()"
                    class="form-input"
                    placeholder="claude-sonnet-4-20250514">
                  <span class="form-help">The Claude model to use for AI features</span>
                </div>

                <div class="form-group">
                  <label class="form-label">API Key</label>
                  <input 
                    type="password" 
                    [(ngModel)]="aiSettings.apiKey"
                    (blur)="updateAISettings()"
                    class="form-input"
                    placeholder="Enter Claude API key">
                  <span class="form-help">Your Anthropic Claude API key (stored securely)</span>
                </div>

                <div class="form-group">
                  <label class="form-label">Max Tokens</label>
                  <input 
                    type="number" 
                    [(ngModel)]="aiSettings.maxTokens"
                    (blur)="updateAISettings()"
                    min="256"
                    max="8192"
                    step="256"
                    class="form-input">
                  <span class="form-help">Maximum tokens for AI responses (256-8192)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Prompts Configuration -->
          <div class="section">
            <h2 class="section-title-small">AI Prompts</h2>
            <div class="prompts-container">
              <!-- Insights Prompt -->
              <div class="prompt-card">
                <div class="prompt-header">
                  <h3 class="prompt-title">Insights Prompt</h3>
                  <span class="prompt-badge">Used for compliance insights</span>
                </div>
                <textarea 
                  [(ngModel)]="aiSettings.prompts.insights"
                  (blur)="updateAISettings()"
                  class="prompt-textarea"
                  rows="12"
                  placeholder="Enter prompt template for insights..."></textarea>
                <div class="prompt-placeholders">
                  <strong>Available placeholders:</strong> &#123;totalViolations&#125;, &#123;complianceRate&#125;, &#123;violationBreakdown&#125;, &#123;trends&#125;, &#123;recentViolationsCount&#125;, &#123;managersCount&#125;
                </div>
              </div>

              <!-- Report Prompt -->
              <div class="prompt-card">
                <div class="prompt-header">
                  <h3 class="prompt-title">Report Prompt</h3>
                  <span class="prompt-badge">Used for compliance reports</span>
                </div>
                <textarea 
                  [(ngModel)]="aiSettings.prompts.report"
                  (blur)="updateAISettings()"
                  class="prompt-textarea"
                  rows="12"
                  placeholder="Enter prompt template for reports..."></textarea>
                <div class="prompt-placeholders">
                  <strong>Available placeholders:</strong> &#123;period&#125;, &#123;totalViolations&#125;, &#123;complianceRate&#125;, &#123;violationBreakdown&#125;, &#123;topViolators&#125;, &#123;managerPerformance&#125;
                </div>
              </div>

              <!-- Anomalies Prompt -->
              <div class="prompt-card">
                <div class="prompt-header">
                  <h3 class="prompt-title">Anomalies Prompt</h3>
                  <span class="prompt-badge">Used for anomaly detection</span>
                </div>
                <textarea 
                  [(ngModel)]="aiSettings.prompts.anomalies"
                  (blur)="updateAISettings()"
                  class="prompt-textarea"
                  rows="12"
                  placeholder="Enter prompt template for anomalies..."></textarea>
                <div class="prompt-placeholders">
                  <strong>Available placeholders:</strong> &#123;userEntries&#125;, &#123;projectEntries&#125;, &#123;timePatterns&#125;
                </div>
              </div>

              <!-- Risk Assessment Prompt -->
              <div class="prompt-card">
                <div class="prompt-header">
                  <h3 class="prompt-title">Risk Assessment Prompt</h3>
                  <span class="prompt-badge">Used for risk analysis</span>
                </div>
                <textarea 
                  [(ngModel)]="aiSettings.prompts.risk"
                  (blur)="updateAISettings()"
                  class="prompt-textarea"
                  rows="12"
                  placeholder="Enter prompt template for risk assessment..."></textarea>
                <div class="prompt-placeholders">
                  <strong>Available placeholders:</strong> &#123;violationsCount&#125;, &#123;userCompliance&#125;, &#123;projectHealth&#125;
                </div>
              </div>

              <!-- Explain Violation Prompt -->
              <div class="prompt-card">
                <div class="prompt-header">
                  <h3 class="prompt-title">Violation Explanation Prompt</h3>
                  <span class="prompt-badge">Used for explaining violations</span>
                </div>
                <textarea 
                  [(ngModel)]="aiSettings.prompts.explainViolation"
                  (blur)="updateAISettings()"
                  class="prompt-textarea"
                  rows="12"
                  placeholder="Enter prompt template for violation explanations..."></textarea>
                <div class="prompt-placeholders">
                  <strong>Available placeholders:</strong> &#123;violationType&#125;, &#123;userName&#125;, &#123;violationDate&#125;, &#123;severity&#125;, &#123;metadata&#125;, &#123;userHistory&#125;, &#123;context&#125;
                </div>
              </div>
            </div>
          </div>

          <div class="section" *ngIf="aiSettingsMessage">
            <div class="sync-status" [class]="aiSettingsMessageType">
              <p>{{ aiSettingsMessage }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Confirmation Modal -->
      <div class="modal-overlay" *ngIf="showConfirmModal" (click)="cancelConfirm()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3 class="modal-title">{{ confirmModalTitle }}</h3>
          <p class="modal-description">{{ confirmModalDescription }}</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="cancelConfirm()">Cancel</button>
            <button class="btn btn-primary" (click)="executeConfirmedSync()">Confirm & Start</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .configuration-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .config-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }

    .config-tab {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: -1px;
    }

    .config-tab:hover {
      color: var(--text-primary);
    }

    .config-tab.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }

    .tab-icon {
      font-size: 1.125rem;
    }

    .tab-label {
      white-space: nowrap;
    }

    .tab-content {
      min-height: 400px;
    }

    .tab-panel {
      animation: fadeIn 0.3s ease-in;
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

    .section-title-small {
      font-family: 'Sora', sans-serif;
      font-size: 1rem;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .section {
      margin-bottom: 3rem;
    }

    .config-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 0;
      border-bottom: 1px solid var(--border);
    }

    .status-row:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: 500;
      color: var(--text-primary);
    }

    .value {
      color: var(--text-secondary);
    }

    .status.connected {
      color: var(--success);
      font-weight: 600;
    }

    .status.disconnected {
      color: var(--danger);
      font-weight: 600;
    }

    .sync-times {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .sync-controls {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .sync-action-card {
      padding: 1.25rem;
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 6px;
      transition: all 0.2s;
    }

    .sync-action-card:hover {
      border-color: var(--primary);
    }

    .sync-action-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .sync-action-header h3 {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
    }

    .sync-description {
      color: var(--text-secondary);
      font-size: 0.875rem;
      line-height: 1.6;
      margin: 0;
    }

    .sync-description strong {
      color: var(--text-primary);
      font-weight: 600;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      font-size: 0.875rem;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background-color: var(--primary);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background-color: var(--primary-dark);
    }

    .btn-secondary {
      background-color: var(--text-tertiary);
      color: white;
    }

    .btn-secondary:hover:not(:disabled) {
      background-color: var(--text-secondary);
    }

    .btn-tertiary {
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }

    .btn-tertiary:hover:not(:disabled) {
      background-color: var(--bg-tertiary);
    }

    .sync-status {
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 6px;
    }

    .sync-status .success {
      background-color: var(--success-bg);
      color: var(--success);
    }

    .sync-status .error {
      background-color: var(--danger-bg);
      color: var(--danger);
    }

    .sync-status .info {
      background-color: var(--info-bg);
      color: var(--info);
    }

    /* Threshold Cards Grid */
    .thresholds-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
      margin-top: 1rem;
    }

    .threshold-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      transition: all 0.2s;
    }

    .threshold-card:hover {
      border-color: var(--primary);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .threshold-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .threshold-title {
      font-family: 'Sora', sans-serif;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .threshold-badge {
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      background-color: var(--bg-secondary);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .threshold-description {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin: 0 0 1.25rem 0;
      line-height: 1.5;
    }

    .threshold-controls {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .threshold-control {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .threshold-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      min-width: 120px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .threshold-input-field {
      flex: 1;
      padding: 0.625rem 0.875rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 0.9375rem;
      font-weight: 500;
      transition: all 0.2s;
      max-width: 120px;
    }

    .threshold-input-field:focus {
      outline: none;
      border-color: var(--primary);
      background-color: var(--bg-card);
    }

    .threshold-unit {
      font-size: 0.875rem;
      color: var(--text-tertiary);
      font-weight: 500;
      min-width: 60px;
    }

    .threshold-logic {
      background-color: var(--bg-secondary);
      border-left: 3px solid var(--primary);
      border-radius: 4px;
      padding: 0.875rem;
      margin-bottom: 1.25rem;
      font-size: 0.8125rem;
      line-height: 1.6;
      color: var(--text-secondary);
    }

    .threshold-logic strong {
      color: var(--text-primary);
      font-weight: 600;
      display: inline-block;
      margin-top: 0.25rem;
    }

    .threshold-logic strong:first-child {
      margin-top: 0;
    }

    .threshold-logic code {
      background-color: var(--bg-tertiary);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: var(--text-primary);
    }

    .info-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .info-title {
      font-family: 'Sora', sans-serif;
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 0.75rem 0;
    }

    .info-text {
      font-size: 0.875rem;
      color: var(--text-secondary);
      line-height: 1.6;
      margin: 0;
    }

    .section-description {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }

    .manager-assignment-controls {
      margin-bottom: 1.5rem;
    }

    .search-filter {
      margin-bottom: 1rem;
    }

    .search-input {
      width: 100%;
      max-width: 400px;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 0.875rem;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--primary);
    }

    .projects-manager-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .project-manager-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      gap: 1.5rem;
    }

    .project-info {
      flex: 1;
      min-width: 0;
    }

    .project-name {
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
    }

    .project-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .project-id {
      font-family: 'JetBrains Mono', monospace;
    }

    .project-status {
      text-transform: capitalize;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      background-color: var(--bg-tertiary);
    }

    .project-status.status-active {
      background-color: var(--success-bg);
      color: var(--success);
    }

    .project-status.status-closed {
      background-color: var(--danger-bg);
      color: var(--danger);
    }

    .manager-select {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 300px;
    }

    .manager-dropdown {
      flex: 1;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background-color: var(--bg-card);
      color: var(--text-primary);
      font-size: 0.875rem;
      cursor: pointer;
    }

    .manager-dropdown:focus {
      outline: none;
      border-color: var(--primary);
    }

    .save-status {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .save-status.success {
      color: var(--success);
    }

    .pagination-controls {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
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

    .loading-state {
      text-align: center;
      padding: 2rem;
      color: var(--text-secondary);
    }

    /* Modal Styles */
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

    .modal-content {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
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

    .modal-title {
      font-family: 'Sora', sans-serif;
      font-size: 1.125rem;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0 0 1rem 0;
    }

    .modal-description {
      color: var(--text-secondary);
      font-size: 0.9375rem;
      line-height: 1.6;
      margin: 0 0 2rem 0;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
    }

    /* AI Settings Styles */
    .ai-settings-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .form-input {
      padding: 0.75rem 1rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 0.9375rem;
      font-family: 'JetBrains Mono', monospace;
      transition: all 0.2s;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--primary);
      background-color: var(--bg-card);
    }

    .form-help {
      font-size: 0.75rem;
      color: var(--text-tertiary);
      font-style: italic;
    }

    .prompts-container {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .prompt-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      transition: all 0.2s;
    }

    .prompt-card:hover {
      border-color: var(--primary);
    }

    .prompt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .prompt-title {
      font-family: 'Sora', sans-serif;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .prompt-badge {
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      background-color: var(--bg-secondary);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .prompt-textarea {
      width: 100%;
      padding: 0.875rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 0.875rem;
      font-family: 'JetBrains Mono', monospace;
      line-height: 1.6;
      resize: vertical;
      min-height: 200px;
      transition: all 0.2s;
    }

    .prompt-textarea:focus {
      outline: none;
      border-color: var(--primary);
      background-color: var(--bg-card);
    }

    .prompt-placeholders {
      margin-top: 0.75rem;
      padding: 0.75rem;
      background-color: var(--bg-secondary);
      border-left: 3px solid var(--primary);
      border-radius: 4px;
      font-size: 0.75rem;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .prompt-placeholders strong {
      color: var(--text-primary);
    }
  `]
})
export class ConfigurationComponent implements OnInit {
  connectionStatus: any = {
    connected: false,
    redmineUrl: '',
    lastSyncTimes: null
  };
  syncing = false;
  syncMessage = '';
  syncMessageType = 'info';
  complianceRules: {
    missingEntryDays: number;
    bulkLoggingThreshold: number;
    lateEntryDays: number;
    lateEntryCheckDays: number;
    staleTaskDays: number;
    overrunThreshold: number;
    staleTaskMonths: number;
    maxSpentHours: number;
  } = {
    missingEntryDays: 7,
    bulkLoggingThreshold: 3,
    lateEntryDays: 3,
    lateEntryCheckDays: 30,
    staleTaskDays: 14,
    overrunThreshold: 150, // Default: 150% (was 1.5x)
    staleTaskMonths: 2,
    maxSpentHours: 350
  };
  savingThreshold = false;
  overrunPercentageDisplay: number = 150; // Display value for the input field (separate from complianceRules to allow typing)

  // Tabs
  activeTab: string = 'sync';
  tabs = [
    { id: 'sync', label: 'Health Check & Sync', icon: '🔄' },
    { id: 'managers', label: 'Manager Assignment', icon: '👥' },
    { id: 'thresholds', label: 'Thresholds & Parameters', icon: '⚙️' },
    { id: 'ai', label: 'AI Settings', icon: '🤖' }
  ];

  // Confirmation Modal
  showConfirmModal: boolean = false;
  confirmModalTitle: string = '';
  confirmModalDescription: string = '';
  pendingSyncAction: string = '';

  // Project Manager Management
  projects: any[] = [];
  filteredProjects: any[] = [];
  users: any[] = [];
  projectSearchTerm: string = '';
  loadingProjects: boolean = false;
  projectsCurrentPage: number = 1;
  projectsTotalPages: number = 1;
  pageSize: number = 20;
  totalProjects: number = 0;

  // Rule explanations
  expandedRules: { [key: string]: boolean } = {};

  // AI Settings
  aiSettings: {
    model: string;
    apiKey: string;
    maxTokens: number;
    prompts: {
      insights: string;
      report: string;
      anomalies: string;
      risk: string;
      explainViolation: string;
    };
  } = {
    model: 'claude-sonnet-4-20250514',
    apiKey: '',
    maxTokens: 4096,
    prompts: {
      insights: '',
      report: '',
      anomalies: '',
      risk: '',
      explainViolation: ''
    }
  };
  aiSettingsMessage: string = '';
  aiSettingsMessageType: string = 'info';
  savingAISettings: boolean = false;

  constructor(
    private redmineService: RedmineService,
    private configService: ConfigService,
    private projectsService: ProjectsService,
    private complianceService: ComplianceService
  ) {}

  ngOnInit() {
    this.loadConnectionStatus();
    this.loadComplianceRules();
    this.loadUsers();
    this.loadProjects();
    this.loadAISettings();
  }

  loadConnectionStatus() {
    this.redmineService.getStatus().subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.connectionStatus = data.data;
        }
      },
      error: (error) => {
        console.error('Error loading connection status:', error);
      }
    });
  }

  // Confirmation methods
  confirmFullSync() {
    this.confirmModalTitle = 'Confirm Full Sync';
    this.confirmModalDescription = 'This will synchronize ALL data from Redmine: users, projects, issues, and time entries (last 90 days). All existing records will be updated with the latest data from Redmine. This operation may take several minutes depending on your data volume. Do you want to proceed?';
    this.pendingSyncAction = 'full';
    this.showConfirmModal = true;
  }

  confirmIncrementalSync() {
    this.confirmModalTitle = 'Confirm Incremental Sync';
    this.confirmModalDescription = 'This will synchronize only data that has been created or updated since the last sync. This includes new or modified users, projects, issues, and time entries. This is faster than a full sync and recommended for regular updates. Do you want to proceed?';
    this.pendingSyncAction = 'incremental';
    this.showConfirmModal = true;
  }

  confirmSyncIssues() {
    this.confirmModalTitle = 'Confirm Issues Sync';
    this.confirmModalDescription = 'This will synchronize ALL issues/tasks from Redmine. All existing issues will be updated with the latest status, assignments, estimates, and timestamps from Redmine. This operation may take a few minutes depending on the number of issues. Do you want to proceed?';
    this.pendingSyncAction = 'issues';
    this.showConfirmModal = true;
  }

  confirmSyncTimeEntries() {
    this.confirmModalTitle = 'Confirm Time Entries Sync';
    this.confirmModalDescription = 'This will synchronize time entries from Redmine (last 90 days). All time tracking data will be updated with the latest entries from Redmine. This is useful for refreshing compliance data. This operation may take a few minutes. Do you want to proceed?';
    this.pendingSyncAction = 'timeEntries';
    this.showConfirmModal = true;
  }

  cancelConfirm() {
    this.showConfirmModal = false;
    this.pendingSyncAction = '';
  }

  executeConfirmedSync() {
    this.showConfirmModal = false;
    
    switch (this.pendingSyncAction) {
      case 'full':
        this.triggerFullSync();
        break;
      case 'incremental':
        this.triggerIncrementalSync();
        break;
      case 'issues':
        this.syncIssuesOnly();
        break;
      case 'timeEntries':
        this.syncTimeEntriesOnly();
        break;
    }
    
    this.pendingSyncAction = '';
  }

  triggerFullSync() {
    this.syncing = true;
    this.syncMessage = 'Full sync started. This may take several minutes...';
    this.syncMessageType = 'info';

    this.redmineService.triggerSync('full').subscribe({
      next: (data: any) => {
        if (data.success) {
          this.syncMessage = 'Full sync started successfully! Check the backend console for progress.';
          this.syncMessageType = 'success';
        }
        this.syncing = false;
        setTimeout(() => this.loadConnectionStatus(), 2000);
      },
      error: (error) => {
        this.syncMessage = 'Error starting sync: ' + (error.error?.message || error.message);
        this.syncMessageType = 'error';
        this.syncing = false;
      }
    });
  }

  triggerIncrementalSync() {
    this.syncing = true;
    this.syncMessage = 'Incremental sync started...';
    this.syncMessageType = 'info';

    this.redmineService.triggerSync('incremental').subscribe({
      next: (data: any) => {
        if (data.success) {
          this.syncMessage = 'Incremental sync started successfully!';
          this.syncMessageType = 'success';
        }
        this.syncing = false;
        setTimeout(() => this.loadConnectionStatus(), 2000);
      },
      error: (error) => {
        this.syncMessage = 'Error starting sync: ' + (error.error?.message || error.message);
        this.syncMessageType = 'error';
        this.syncing = false;
      }
    });
  }

  syncIssuesOnly() {
    this.syncing = true;
    this.syncMessage = 'Issues sync started. This may take a few minutes...';
    this.syncMessageType = 'info';

    this.redmineService.triggerSync('full', 'issues').subscribe({
      next: (data: any) => {
        if (data.success) {
          this.syncMessage = 'Issues sync started successfully!';
          this.syncMessageType = 'success';
        }
        this.syncing = false;
        setTimeout(() => this.loadConnectionStatus(), 2000);
      },
      error: (error) => {
        this.syncMessage = 'Error starting sync: ' + (error.error?.message || error.message);
        this.syncMessageType = 'error';
        this.syncing = false;
      }
    });
  }

  syncTimeEntriesOnly() {
    this.syncing = true;
    this.syncMessage = 'Time entries sync started. This may take a few minutes...';
    this.syncMessageType = 'info';

    this.redmineService.triggerSync('full', 'timeEntries').subscribe({
      next: (data: any) => {
        if (data.success) {
          this.syncMessage = 'Time entries sync started successfully!';
          this.syncMessageType = 'success';
        }
        this.syncing = false;
        setTimeout(() => this.loadConnectionStatus(), 2000);
      },
      error: (error) => {
        this.syncMessage = 'Error starting sync: ' + (error.error?.message || error.message);
        this.syncMessageType = 'error';
        this.syncing = false;
      }
    });
  }

  loadComplianceRules() {
    this.configService.getComplianceRules().subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          // Update compliance rules with data from API, preserving defaults for missing values
          this.complianceRules = { 
            missingEntryDays: data.data.missingEntryDays ?? 7,
            bulkLoggingThreshold: data.data.bulkLoggingThreshold ?? 3,
            lateEntryDays: data.data.lateEntryDays ?? 3,
            lateEntryCheckDays: data.data.lateEntryCheckDays ?? 30,
            staleTaskDays: data.data.staleTaskDays ?? 14,
            // Handle backward compatibility: if value < 10, it's old format (multiplier), convert to percentage
            overrunThreshold: data.data.overrunThreshold 
              ? (data.data.overrunThreshold < 10 ? data.data.overrunThreshold * 100 : data.data.overrunThreshold)
              : 150,
            staleTaskMonths: data.data.staleTaskMonths ?? 2,
            maxSpentHours: data.data.maxSpentHours ?? 350
          };
          // Initialize display value for overrun percentage
          const threshold = this.complianceRules.overrunThreshold || 150;
          this.overrunPercentageDisplay = threshold < 10 ? Math.round(threshold * 100) : threshold;
        }
      },
      error: (error) => {
        console.error('Error loading compliance rules:', error);
        // Ensure defaults are set even on error
        this.complianceRules = {
          missingEntryDays: 7,
          bulkLoggingThreshold: 3,
          lateEntryDays: 3,
          lateEntryCheckDays: 30,
          staleTaskDays: 14,
          overrunThreshold: 150, // Default: 150% (was 1.5x)
          staleTaskMonths: 2,
          maxSpentHours: 350
        };
        this.overrunPercentageDisplay = 150;
      }
    });
  }

  updateOverrunThreshold() {
    const percentage = parseFloat(this.overrunPercentageDisplay.toString());
    
    if (isNaN(percentage) || percentage < 100 || percentage > 1000) {
      alert('Overrun threshold must be between 100% and 1000%');
      // Reset to current value from complianceRules
      const threshold = this.complianceRules.overrunThreshold || 150;
      this.overrunPercentageDisplay = threshold < 10 ? Math.round(threshold * 100) : threshold;
      return;
    }
    
    // Handle backward compatibility: if value < 10, it's old format (multiplier), convert to percentage
    const finalPercentage = percentage < 10 ? percentage * 100 : percentage;

    this.savingThreshold = true;
    this.configService.updateComplianceRules({ overrunThreshold: finalPercentage }).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.complianceRules = { ...this.complianceRules, ...data.data };
          // Update display value to match saved value
          const threshold = this.complianceRules.overrunThreshold || 150;
          this.overrunPercentageDisplay = threshold < 10 ? Math.round(threshold * 100) : threshold;
          this.syncMessage = `Overrun threshold updated to ${finalPercentage}%`;
          this.syncMessageType = 'success';
          setTimeout(() => {
            this.syncMessage = '';
          }, 3000);
        }
        this.savingThreshold = false;
      },
      error: (error) => {
        console.error('Error updating overrun threshold:', error);
        alert('Error updating threshold: ' + (error.error?.message || error.message));
        // Reset display value to current complianceRules value
        const threshold = this.complianceRules.overrunThreshold || 150;
        this.overrunPercentageDisplay = threshold < 10 ? Math.round(threshold * 100) : threshold;
        this.savingThreshold = false;
      }
    });
  }

  onStaleTaskMonthsChange(value: any) {
    this.complianceRules.staleTaskMonths = parseInt(value) || 2;
  }

  updateStaleTaskMonths() {
    const months = parseInt(this.complianceRules.staleTaskMonths.toString());
    
    if (isNaN(months) || months < 1 || months > 12) {
      alert('Stale task months must be between 1 and 12');
      this.loadComplianceRules();
      return;
    }

    this.savingThreshold = true;
    this.configService.updateComplianceRules({ staleTaskMonths: months }).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.complianceRules = { ...this.complianceRules, ...data.data };
          this.syncMessage = `Stale task months updated to ${months} months`;
          this.syncMessageType = 'success';
          setTimeout(() => {
            this.syncMessage = '';
          }, 3000);
        }
        this.savingThreshold = false;
      },
      error: (error) => {
        console.error('Error updating stale task months:', error);
        alert('Error updating threshold: ' + (error.error?.message || error.message));
        this.loadComplianceRules();
        this.savingThreshold = false;
      }
    });
  }

  onMaxSpentHoursChange(value: any) {
    this.complianceRules.maxSpentHours = parseInt(value) || 350;
  }

  updateMaxSpentHours() {
    const hours = parseInt(this.complianceRules.maxSpentHours.toString());
    
    if (isNaN(hours) || hours < 1 || hours > 10000) {
      alert('Max spent hours must be between 1 and 10000');
      this.loadComplianceRules();
      return;
    }

    this.savingThreshold = true;
    this.configService.updateComplianceRules({ maxSpentHours: hours }).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.complianceRules = { ...this.complianceRules, ...data.data };
          this.syncMessage = `Max spent hours updated to ${hours} hours`;
          this.syncMessageType = 'success';
          setTimeout(() => {
            this.syncMessage = '';
          }, 3000);
        }
        this.savingThreshold = false;
      },
      error: (error) => {
        console.error('Error updating max spent hours:', error);
        alert('Error updating threshold: ' + (error.error?.message || error.message));
        this.loadComplianceRules();
        this.savingThreshold = false;
      }
    });
  }

  onLateEntryDaysChange(value: any) {
    this.complianceRules.lateEntryDays = parseInt(value) || 3;
  }

  updateLateEntryDays() {
    const days = parseInt(this.complianceRules.lateEntryDays.toString());
    
    if (isNaN(days) || days < 1 || days > 30) {
      alert('Late entry threshold must be between 1 and 30 days');
      this.loadComplianceRules();
      return;
    }

    this.savingThreshold = true;
    this.configService.updateComplianceRules({ lateEntryDays: days }).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.complianceRules = { ...this.complianceRules, ...data.data };
          this.syncMessage = `Late entry threshold updated to ${days} days`;
          this.syncMessageType = 'success';
          setTimeout(() => {
            this.syncMessage = '';
          }, 3000);
        }
        this.savingThreshold = false;
      },
      error: (error) => {
        console.error('Error updating late entry threshold:', error);
        alert('Error updating threshold: ' + (error.error?.message || error.message));
        this.loadComplianceRules();
        this.savingThreshold = false;
      }
    });
  }

  onLateEntryCheckDaysChange(value: any) {
    this.complianceRules.lateEntryCheckDays = parseInt(value) || 30;
  }

  updateLateEntryCheckDays() {
    const days = parseInt(this.complianceRules.lateEntryCheckDays.toString());
    
    if (isNaN(days) || days < 1 || days > 365) {
      alert('Late entry check window must be between 1 and 365 days');
      this.loadComplianceRules();
      return;
    }

    this.savingThreshold = true;
    this.configService.updateComplianceRules({ lateEntryCheckDays: days }).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.complianceRules = { ...this.complianceRules, ...data.data };
          this.syncMessage = `Late entry check window updated to ${days} days`;
          this.syncMessageType = 'success';
          setTimeout(() => {
            this.syncMessage = '';
          }, 3000);
        }
        this.savingThreshold = false;
      },
      error: (error) => {
        console.error('Error updating late entry check window:', error);
        alert('Error updating check window: ' + (error.error?.message || error.message));
        this.loadComplianceRules();
        this.savingThreshold = false;
      }
    });
  }

  onMissingEntryDaysChange(value: any) {
    this.complianceRules.missingEntryDays = parseInt(value) || 7;
  }

  updateMissingEntryDays() {
    const days = parseInt(this.complianceRules.missingEntryDays.toString());
    
    if (isNaN(days) || days < 1 || days > 30) {
      alert('Missing entry days must be between 1 and 30');
      this.loadComplianceRules();
      return;
    }

    this.savingThreshold = true;
    this.configService.updateComplianceRules({ missingEntryDays: days }).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.complianceRules = { ...this.complianceRules, ...data.data };
          this.syncMessage = `Missing entry days updated to ${days} days`;
          this.syncMessageType = 'success';
          setTimeout(() => {
            this.syncMessage = '';
          }, 3000);
        }
        this.savingThreshold = false;
      },
      error: (error) => {
        console.error('Error updating missing entry days:', error);
        alert('Error updating threshold: ' + (error.error?.message || error.message));
        this.loadComplianceRules();
        this.savingThreshold = false;
      }
    });
  }

  onStaleTaskDaysChange(value: any) {
    this.complianceRules.staleTaskDays = parseInt(value) || 14;
  }

  updateStaleTaskDays() {
    const days = parseInt(this.complianceRules.staleTaskDays.toString());
    
    if (isNaN(days) || days < 1 || days > 90) {
      alert('Stale task days must be between 1 and 90');
      this.loadComplianceRules();
      return;
    }

    this.savingThreshold = true;
    this.configService.updateComplianceRules({ staleTaskDays: days }).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.complianceRules = { ...this.complianceRules, ...data.data };
          this.syncMessage = `Stale task days updated to ${days} days`;
          this.syncMessageType = 'success';
          setTimeout(() => {
            this.syncMessage = '';
          }, 3000);
        }
        this.savingThreshold = false;
      },
      error: (error) => {
        console.error('Error updating stale task days:', error);
        alert('Error updating threshold: ' + (error.error?.message || error.message));
        this.loadComplianceRules();
        this.savingThreshold = false;
      }
    });
  }

  getSyncTimes() {
    if (!this.connectionStatus.lastSyncTimes) return [];
    
    const times = this.connectionStatus.lastSyncTimes;
    return [
      { entity: 'Users', time: times.users ? new Date(times.users).toLocaleString() : null },
      { entity: 'Projects', time: times.projects ? new Date(times.projects).toLocaleString() : null },
      { entity: 'Issues', time: times.issues ? new Date(times.issues).toLocaleString() : null },
      { entity: 'Time Entries', time: times.timeEntries ? new Date(times.timeEntries).toLocaleString() : null },
    ];
  }

  loadUsers() {
    this.complianceService.getAllUsers().subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.users = data.data;
        }
      },
      error: (error) => {
        console.error('Error loading users:', error);
      }
    });
  }

  loadProjects() {
    this.loadingProjects = true;
    this.projectsService.getProjects(this.projectsCurrentPage, this.pageSize).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.projects = data.data.map((project: any) => ({
            ...project,
            managerId: project.manager?.id || null,
            saving: false,
            saved: false
          }));
          this.totalProjects = data.pagination?.total || 0;
          this.projectsTotalPages = data.pagination?.totalPages || 1;
          this.filterProjects();
        }
        this.loadingProjects = false;
      },
      error: (error) => {
        console.error('Error loading projects:', error);
        this.loadingProjects = false;
      }
    });
  }

  filterProjects() {
    if (!this.projectSearchTerm.trim()) {
      this.filteredProjects = [...this.projects];
      return;
    }

    const searchTerm = this.projectSearchTerm.toLowerCase();
    this.filteredProjects = this.projects.filter(project =>
      project.name.toLowerCase().includes(searchTerm) ||
      project.redmineProjectId.toString().includes(searchTerm) ||
      (project.manager?.name && project.manager.name.toLowerCase().includes(searchTerm))
    );
  }

  onManagerChange(project: any, event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const newManagerId = selectElement.value || null;

    // Don't update if unchanged
    if (newManagerId === project.managerId) {
      return;
    }

    project.saving = true;
    project.saved = false;

    this.projectsService.updateProjectManager(project.id, newManagerId).subscribe({
      next: (data: any) => {
        if (data.success) {
          project.managerId = newManagerId;
          project.manager = data.data?.manager || null;
          project.saving = false;
          project.saved = true;
          
          // Clear saved status after 2 seconds
          setTimeout(() => {
            project.saved = false;
          }, 2000);
        }
      },
      error: (error) => {
        console.error('Error updating project manager:', error);
        project.saving = false;
        alert('Error updating manager: ' + (error.error?.message || error.message));
        // Reset dropdown to previous value
        selectElement.value = project.managerId || '';
      }
    });
  }

  previousProjectsPage() {
    if (this.projectsCurrentPage > 1) {
      this.projectsCurrentPage--;
      this.loadProjects();
    }
  }

  nextProjectsPage() {
    if (this.projectsCurrentPage < this.projectsTotalPages) {
      this.projectsCurrentPage++;
      this.loadProjects();
    }
  }

  toggleRuleExplanation(ruleKey: string) {
    this.expandedRules[ruleKey] = !this.expandedRules[ruleKey];
  }

  loadAISettings() {
    this.configService.getAISettings().subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.aiSettings = {
            model: data.data.model || 'claude-sonnet-4-20250514',
            apiKey: data.data.apiKey || '',
            maxTokens: data.data.maxTokens || 4096,
            prompts: {
              insights: data.data.prompts?.insights || '',
              report: data.data.prompts?.report || '',
              anomalies: data.data.prompts?.anomalies || '',
              risk: data.data.prompts?.risk || '',
              explainViolation: data.data.prompts?.explainViolation || ''
            }
          };
        }
      },
      error: (error) => {
        console.error('Error loading AI settings:', error);
      }
    });
  }

  updateAISettings() {
    if (this.savingAISettings) return;
    
    this.savingAISettings = true;
    this.aiSettingsMessage = '';
    
    this.configService.updateAISettings({
      model: this.aiSettings.model,
      apiKey: this.aiSettings.apiKey,
      maxTokens: this.aiSettings.maxTokens,
      prompts: this.aiSettings.prompts
    }).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.aiSettingsMessage = 'AI settings updated successfully';
          this.aiSettingsMessageType = 'success';
          setTimeout(() => {
            this.aiSettingsMessage = '';
          }, 3000);
        }
        this.savingAISettings = false;
      },
      error: (error) => {
        console.error('Error updating AI settings:', error);
        this.aiSettingsMessage = 'Error updating AI settings: ' + (error.error?.message || error.message);
        this.aiSettingsMessageType = 'error';
        this.savingAISettings = false;
      }
    });
  }
}
