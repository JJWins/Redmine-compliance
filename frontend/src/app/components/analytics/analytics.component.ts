import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { AIService } from '../../services/ai.service';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="analytics-container">
      <!-- Header -->
      <div class="page-header">
        <h1 class="page-title">Analytics</h1>
        <p class="page-subtitle">AI-powered insights and performance analysis</p>
      </div>

      <!-- Tabs -->
      <div class="tabs-container">
        <div class="tabs">
          <button 
            *ngFor="let tab of tabs"
            [class.active]="activeTab === tab.id"
            (click)="activeTab = tab.id"
            class="tab-button">
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Tab 1: AI Insights -->
        <div *ngIf="activeTab === 'insights'" class="tab-panel">
          <div class="section">
            <div class="section-header">
              <h2 class="section-title-small">AI Insights</h2>
              <button class="btn-refresh" (click)="loadInsights()" [disabled]="loadingInsights">
                {{ loadingInsights ? 'Generating...' : '🔄 Refresh Insights' }}
              </button>
            </div>
            <div class="insights-card" *ngIf="aiInsights">
              <div class="insights-content" [innerHTML]="sanitizeHtml(aiInsights)"></div>
              <div class="insights-footer">
                <span class="insights-meta">Generated: {{ insightsGeneratedAt | date:'short' }}</span>
              </div>
            </div>
            <div class="insights-error" *ngIf="insightsError">
              <p>{{ insightsError }}</p>
            </div>
            <div class="insights-loading" *ngIf="loadingInsights">
              <p>🤖 AI is analyzing your compliance data...</p>
            </div>
          </div>
        </div>

        <!-- Tab 2: Risk Assessment -->
        <div *ngIf="activeTab === 'risk'" class="tab-panel">
          <div class="section">
            <div class="section-header">
              <h2 class="section-title-small">Risk Assessment</h2>
              <button class="btn-refresh" (click)="loadRiskAssessment()" [disabled]="loadingRisk">
                {{ loadingRisk ? 'Analyzing...' : '🔄 Assess Risk' }}
              </button>
            </div>
            <div class="insights-card" *ngIf="riskAssessment">
              <div class="insights-content" [innerHTML]="sanitizeHtml(riskAssessment)"></div>
              <div class="insights-footer">
                <span class="insights-meta">Analyzed: {{ riskAnalyzedAt | date:'short' }}</span>
              </div>
            </div>
            <div class="insights-loading" *ngIf="loadingRisk">
              <p>🔍 Analyzing risk levels...</p>
            </div>
          </div>
        </div>

        <!-- Tab 3: Anomaly Detection -->
        <div *ngIf="activeTab === 'anomalies'" class="tab-panel">
          <div class="section">
            <div class="section-header">
              <h2 class="section-title-small">Anomaly Detection</h2>
              <button class="btn-refresh" (click)="loadAnomalies()" [disabled]="loadingAnomalies">
                {{ loadingAnomalies ? 'Detecting...' : '🔍 Detect Anomalies' }}
              </button>
            </div>
            <div class="insights-card" *ngIf="anomalies">
              <div class="insights-content" [innerHTML]="sanitizeHtml(anomalies)"></div>
              <div class="insights-footer">
                <span class="insights-meta">Analyzed: {{ anomaliesAnalyzedAt | date:'short' }}</span>
              </div>
            </div>
            <div class="insights-loading" *ngIf="loadingAnomalies">
              <p>🔎 Detecting unusual patterns...</p>
            </div>
          </div>
        </div>

        <!-- Tab 4: Compliance Reports -->
        <div *ngIf="activeTab === 'reports'" class="tab-panel">
          <div class="section">
            <div class="section-header">
              <h2 class="section-title-small">Compliance Reports</h2>
              <div class="report-controls">
                <button class="btn-report" (click)="generateReport('week')" [disabled]="generatingReport">
                  {{ generatingReport ? 'Generating...' : '📊 Weekly Report' }}
                </button>
                <button class="btn-report" (click)="generateReport('month')" [disabled]="generatingReport">
                  {{ generatingReport ? 'Generating...' : '📈 Monthly Report' }}
                </button>
              </div>
            </div>
            <div class="insights-card" *ngIf="report">
              <div class="report-header">
                <h3 class="report-title">{{ reportPeriod === 'week' ? 'Weekly' : 'Monthly' }} Compliance Report</h3>
                <button class="btn-download" (click)="downloadReport()">📥 Download</button>
              </div>
              <div class="insights-content report-content" [innerHTML]="sanitizeHtml(report)"></div>
              <div class="insights-footer">
                <span class="insights-meta">Generated: {{ reportGeneratedAt | date:'short' }}</span>
              </div>
            </div>
            <div class="insights-loading" *ngIf="generatingReport">
              <p>📝 Generating comprehensive report...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .analytics-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-title {
      font-family: 'Sora', sans-serif;
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .page-subtitle {
      color: var(--text-secondary);
      font-size: 1rem;
    }

    /* Tabs */
    .tabs-container {
      margin-bottom: 2rem;
    }

    .tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 2px solid var(--border);
    }

    .tab-button {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      color: var(--text-secondary);
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: -2px;
    }

    .tab-button:hover {
      color: var(--text-primary);
      background-color: var(--bg-secondary);
    }

    .tab-button.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
      font-weight: 600;
    }

    .tab-icon {
      font-size: 1.125rem;
    }

    .tab-label {
      font-family: 'Sora', sans-serif;
    }

    .tab-content {
      margin-top: 2rem;
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

    .section {
      margin-bottom: 2rem;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .section-title-small {
      font-family: 'Sora', sans-serif;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0;
    }

    .btn-refresh, .btn-report {
      padding: 0.625rem 1.25rem;
      background-color: var(--primary);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'Sora', sans-serif;
    }

    .btn-refresh:hover:not(:disabled), .btn-report:hover:not(:disabled) {
      background-color: var(--primary-dark);
      transform: translateY(-1px);
    }

    .btn-refresh:disabled, .btn-report:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .report-controls {
      display: flex;
      gap: 0.75rem;
    }

    .insights-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }

    .insights-content {
      color: var(--text-primary);
      line-height: 1.8;
      font-size: 0.9375rem;
    }

    .insights-content h1, .insights-content h2, .insights-content h3, .insights-content h4 {
      color: var(--text-primary);
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      font-weight: 600;
      font-family: 'Sora', sans-serif;
    }

    .insights-content h1 {
      font-size: 1.75rem;
    }

    .insights-content h2 {
      font-size: 1.5rem;
    }

    .insights-content h3 {
      font-size: 1.25rem;
    }

    .insights-content h4 {
      font-size: 1.125rem;
    }

    .insights-content ul, .insights-content ol {
      margin: 1rem 0;
      padding-left: 2rem;
    }

    .insights-content li {
      margin: 0.5rem 0;
    }

    .insights-content strong {
      color: var(--text-primary);
      font-weight: 600;
    }

    .insights-content p {
      margin: 0.75rem 0;
    }

    .insights-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      border: 1px solid var(--border);
    }

    .insights-content th, .insights-content td {
      padding: 0.75rem;
      text-align: left;
      border: 1px solid var(--border);
    }

    .insights-content th {
      background-color: var(--bg-secondary);
      font-weight: 600;
      color: var(--text-primary);
    }

    .insights-content tr:hover {
      background-color: var(--bg-secondary);
    }

    /* Allow inline styles from AI-generated HTML */
    .insights-content ::ng-deep * {
      /* Preserve inline styles from AI-generated content */
    }

    .insights-content ::ng-deep table {
      border-collapse: collapse !important;
      width: 100% !important;
    }

    .insights-content ::ng-deep td, .insights-content ::ng-deep th {
      border: 1px solid var(--border) !important;
      padding: 0.75rem !important;
    }

    .insights-footer {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }

    .insights-meta {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .insights-loading, .insights-error {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 2rem;
      text-align: center;
      color: var(--text-secondary);
    }

    .insights-error {
      color: var(--danger);
      background-color: var(--danger-bg);
      border-color: var(--danger);
    }

    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }

    .report-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      font-family: 'Sora', sans-serif;
    }

    .btn-download {
      padding: 0.5rem 1rem;
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'Sora', sans-serif;
    }

    .btn-download:hover {
      background-color: var(--bg-tertiary);
      border-color: var(--primary);
    }

    .report-content {
      max-height: 600px;
      overflow-y: auto;
    }
  `]
})
export class AnalyticsComponent implements OnInit {
  // Tabs
  activeTab: string = 'insights';
  tabs = [
    { id: 'insights', label: 'AI Insights', icon: '🤖' },
    { id: 'risk', label: 'Risk Assessment', icon: '🔍' },
    { id: 'anomalies', label: 'Anomaly Detection', icon: '🔎' },
    { id: 'reports', label: 'Compliance Reports', icon: '📊' }
  ];

  // AI Features
  aiInsights: string = '';
  insightsGeneratedAt: Date | null = null;
  loadingInsights: boolean = false;
  insightsError: string = '';

  riskAssessment: string = '';
  riskAnalyzedAt: Date | null = null;
  loadingRisk: boolean = false;

  anomalies: string = '';
  anomaliesAnalyzedAt: Date | null = null;
  loadingAnomalies: boolean = false;

  report: string = '';
  reportPeriod: 'week' | 'month' = 'week';
  reportGeneratedAt: Date | null = null;
  generatingReport: boolean = false;

  constructor(
    private aiService: AIService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.loadInsights();
  }

  sanitizeHtml(content: string): SafeHtml {
    if (!content) return '';
    
    // Check if content is already HTML (contains HTML tags)
    const isHtml = /<[a-z][\s\S]*>/i.test(content);
    
    if (isHtml) {
      // Content is already HTML - use bypassSecurityTrustHtml to allow rendering
      // This is safe because the content comes from our own AI service
      return this.sanitizer.bypassSecurityTrustHtml(content);
    } else {
      // Content is markdown, convert to HTML first
      const html = this.formatMarkdownToHtml(content);
      return this.sanitizer.bypassSecurityTrustHtml(html);
    }
  }

  formatMarkdownToHtml(text: string): string {
    if (!text) return '';
    
    // Convert markdown-style formatting to HTML
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^(\d+\.\s.*$)/gim, '<p>$1</p>')
      .replace(/^[-*]\s(.*$)/gim, '<li>$1</li>')
      .replace(/\n/g, '<br>');

    // Wrap lists
    formatted = formatted.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');

    return formatted;
  }

  // AI Methods
  loadInsights() {
    this.loadingInsights = true;
    this.insightsError = '';
    this.aiService.getInsights().subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.aiInsights = data.data.insights;
          this.insightsGeneratedAt = new Date(data.data.generatedAt);
        }
        this.loadingInsights = false;
      },
      error: (error) => {
        console.error('Error loading insights:', error);
        this.insightsError = error.error?.message || 'Failed to generate insights. Please check if Claude API key is configured.';
        this.loadingInsights = false;
      }
    });
  }

  loadRiskAssessment() {
    this.loadingRisk = true;
    this.aiService.assessRisk().subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.riskAssessment = data.data.riskAssessment;
          this.riskAnalyzedAt = new Date(data.data.generatedAt);
        }
        this.loadingRisk = false;
      },
      error: (error) => {
        console.error('Error assessing risk:', error);
        this.loadingRisk = false;
      }
    });
  }

  loadAnomalies() {
    this.loadingAnomalies = true;
    this.aiService.detectAnomalies().subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.anomalies = data.data.anomalies;
          this.anomaliesAnalyzedAt = new Date(data.data.generatedAt);
        }
        this.loadingAnomalies = false;
      },
      error: (error) => {
        console.error('Error detecting anomalies:', error);
        this.loadingAnomalies = false;
      }
    });
  }

  generateReport(period: 'week' | 'month') {
    this.generatingReport = true;
    this.reportPeriod = period;
    this.aiService.generateReport(period).subscribe({
      next: (data: any) => {
        if (data.success && data.data) {
          this.report = data.data.report;
          this.reportGeneratedAt = new Date(data.data.generatedAt);
        }
        this.generatingReport = false;
      },
      error: (error) => {
        console.error('Error generating report:', error);
        this.generatingReport = false;
      }
    });
  }

  downloadReport() {
    if (!this.report) return;

    // Create HTML document
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Compliance Report - ${this.reportPeriod}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 1200px;
              margin: 0 auto;
              padding: 2rem;
            }
            h1, h2, h3, h4 {
              color: #1a1a1a;
              margin-top: 2rem;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 1.5rem 0;
            }
            th, td {
              padding: 0.75rem;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            th {
              background-color: #f5f5f5;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <h1>${this.reportPeriod === 'week' ? 'Weekly' : 'Monthly'} Compliance Report</h1>
          <p><em>Generated: ${this.reportGeneratedAt?.toLocaleString()}</em></p>
          ${this.report}
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${this.reportPeriod}-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
