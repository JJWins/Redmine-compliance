import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if token exists in localStorage
  const token = authService.getToken();
  if (!token) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // If user is already loaded, allow access immediately
  if (authService.isUserLoaded()) {
    return true;
  }

  // Ensure user loading is triggered (in case it wasn't called yet)
  // This is safe to call multiple times - loadUserFromToken has guards against duplicate calls
  authService.refreshUser();

  // If token exists, allow access
  // The user will load in the background, and components can show loading state
  // The interceptor will handle 401 errors and redirect to login if token is invalid
  // Don't block navigation - let the user through and let components handle loading state
  return true;
};

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const user = authService.getCurrentUser();
    if (user && allowedRoles.includes(user.role)) {
      return true;
    }

    // Redirect to dashboard if user doesn't have required role
    router.navigate(['/']);
    return false;
  };
};

