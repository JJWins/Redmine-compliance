import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-card" [class.clickable]="clickable" (click)="onClick()" [title]="description || ''">
      <div class="stat-header">
        <span class="stat-label">{{ label }}</span>
        <span class="stat-icon" [style.color]="iconColor">●</span>
      </div>
      <div class="stat-value">{{ value }}</div>
      <div class="stat-description" *ngIf="description">
        <span class="description-icon">ℹ️</span>
        <span class="description-text">{{ description }}</span>
      </div>
      <div class="stat-change" [class.positive]="change > 0" [class.negative]="change < 0" *ngIf="change !== null">
        {{ change > 0 ? '+' : '' }}{{ change }}% from last period
      </div>
      <div class="stat-action" *ngIf="clickable">
        <span class="action-text">View Details →</span>
      </div>
    </div>
  `,
  styles: [`
    .stat-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      transition: border-color 0.2s;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .stat-card:hover {
      border-color: var(--primary);
    }

    .stat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .stat-label {
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
    }

    .stat-icon {
      font-size: 0.5rem;
    }

    .stat-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 2rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
      flex-shrink: 0;
    }

    .stat-change {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .stat-change.positive {
      color: var(--success);
    }

    .stat-change.negative {
      color: var(--danger);
    }

    .stat-card.clickable {
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }

    .stat-card.clickable:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border-color: var(--primary);
    }

    .stat-card.clickable:active {
      transform: translateY(0);
    }

    .stat-action {
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    .action-text {
      font-size: 0.75rem;
      color: var(--primary);
      font-weight: 500;
    }

    .stat-description {
      margin-top: 0.5rem;
      padding: 0.5rem;
      background-color: var(--bg-secondary);
      border-radius: 4px;
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--text-secondary);
      line-height: 1.4;
      flex: 1;
      min-height: 0;
    }

    .description-icon {
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .description-text {
      flex: 1;
    }
  `]
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: string | number = 0;
  @Input() change: number | null = null;
  @Input() iconColor: string = '#4F46E5';
  @Input() clickable: boolean = false;
  @Input() description: string = '';
  @Output() cardClick = new EventEmitter<void>();

  onClick() {
    if (this.clickable) {
      this.cardClick.emit();
    }
  }
}

