import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './guards/auth.guard';

export const appRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'users',
    loadComponent: () => import('./components/users/users.component').then(m => m.UsersComponent),
    canActivate: [authGuard, roleGuard(['admin'])],
  },
  {
    path: 'projects',
    loadComponent: () => import('./components/projects/projects.component').then(m => m.ProjectsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'issues',
    loadComponent: () => import('./components/issues/issues.component').then(m => m.IssuesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'violations',
    loadComponent: () => import('./components/violations/violations.component').then(m => m.ViolationsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'analytics',
    loadComponent: () => import('./components/analytics/analytics.component').then(m => m.AnalyticsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'configuration',
    loadComponent: () => import('./components/configuration/configuration.component').then(m => m.ConfigurationComponent),
    canActivate: [authGuard, roleGuard(['admin'])],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

