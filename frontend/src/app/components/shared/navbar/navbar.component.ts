import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ThemeService, Theme } from '../../../services/theme.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar">
      <div class="navbar-container">
        <div class="navbar-brand">
          <h2>Redmine Compliance</h2>
        </div>
        <div class="navbar-links">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
            Dashboard
          </a>
          <a routerLink="/analytics" routerLinkActive="active">
            Analytics
          </a>
          <a *ngIf="isAdmin()" routerLink="/configuration" routerLinkActive="active">
            Configuration
          </a>
          <div class="user-menu">
            <span class="user-name">{{ currentUser?.name || 'User' }}</span>
            <span class="user-role">{{ currentUser?.role || 'user' }}</span>
            <button class="logout-button" (click)="logout()" title="Logout">
              Logout
            </button>
          </div>
          <button class="theme-toggle" (click)="toggleTheme()" [title]="currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
            <span *ngIf="currentTheme === 'dark'">☀️</span>
            <span *ngIf="currentTheme === 'light'">🌙</span>
          </button>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      background-color: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .navbar-container {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .navbar-brand h2 {
      font-family: 'Sora', sans-serif;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .navbar-links {
      display: flex;
      gap: 2rem;
    }

    .navbar-links a {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.95rem;
      font-weight: 500;
      padding: 0.5rem 0;
      transition: color 0.2s;
      border-bottom: 2px solid transparent;
    }

    .navbar-links a:hover {
      color: var(--text-primary);
    }

    .navbar-links a.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }

    .theme-toggle {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      font-size: 1.25rem;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 1rem;
    }

    .theme-toggle:hover {
      background-color: var(--bg-tertiary);
      border-color: var(--primary);
      transform: scale(1.05);
    }

    .theme-toggle:active {
      transform: scale(0.95);
    }

    .user-menu {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-left: 1rem;
      padding-left: 1rem;
      border-left: 1px solid var(--border);
    }

    .user-name {
      color: var(--text-primary);
      font-size: 0.875rem;
      font-weight: 500;
    }

    .user-role {
      color: var(--text-secondary);
      font-size: 0.75rem;
      text-transform: uppercase;
      background-color: var(--bg-card);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .logout-button {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.5rem 1rem;
      color: var(--text-primary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .logout-button:hover {
      background-color: var(--bg-tertiary);
      border-color: var(--primary);
    }
  `]
})
export class NavbarComponent implements OnInit, OnDestroy {
  currentTheme: Theme = 'dark';
  currentUser: any = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private themeService: ThemeService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.subscriptions.push(
      this.themeService.theme$.subscribe(theme => {
        this.currentTheme = theme;
      })
    );

    this.subscriptions.push(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  logout() {
    this.authService.logout();
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }
}

