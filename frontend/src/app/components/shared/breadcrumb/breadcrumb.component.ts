import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  route?: string;
  queryParams?: any;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <nav class="breadcrumb">
      <ol class="breadcrumb-list">
        <li *ngFor="let item of items; let last = last" class="breadcrumb-item">
          <a 
            *ngIf="!last && item.route" 
            [routerLink]="item.route" 
            [queryParams]="item.queryParams"
            class="breadcrumb-link">
            {{ item.label }}
          </a>
          <span *ngIf="last || !item.route" class="breadcrumb-current">
            {{ item.label }}
          </span>
          <span *ngIf="!last" class="breadcrumb-separator">/</span>
        </li>
      </ol>
    </nav>
  `,
  styles: [`
    .breadcrumb {
      margin-bottom: 1.5rem;
    }

    .breadcrumb-list {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      list-style: none;
      padding: 0;
      margin: 0;
      flex-wrap: wrap;
    }

    .breadcrumb-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .breadcrumb-link {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
      transition: color 0.2s;
    }

    .breadcrumb-link:hover {
      color: var(--primary);
    }

    .breadcrumb-current {
      color: var(--text-primary);
      font-size: 0.875rem;
      font-weight: 500;
    }

    .breadcrumb-separator {
      color: var(--text-tertiary);
      font-size: 0.875rem;
    }
  `]
})
export class BreadcrumbComponent {
  @Input() items: BreadcrumbItem[] = [];
}

