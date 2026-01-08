import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user';
  managerId?: string;
  status?: number;
  mustChangePassword?: boolean;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    mustChangePassword?: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenKey = 'auth_token';
  private isLoadingUser = false;
  private loadUserSubscription: any = null;

  constructor(
    private http: HttpClient,
    private apiService: ApiService,
    private router: Router
  ) {
    this.loadUserFromToken();
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.apiService.post<LoginResponse>('/auth/login', { email, password }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.setToken(response.data.token);
          this.currentUserSubject.next(response.data.user);
        }
      })
    );
  }

  logout(): void {
    if (this.loadUserSubscription) {
      this.loadUserSubscription.unsubscribe();
      this.loadUserSubscription = null;
    }
    
    this.isLoadingUser = false;
    localStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  isUserLoaded(): boolean {
    return !!this.currentUserSubject.value;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAdmin(): boolean {
    return this.currentUserSubject.value?.role === 'admin';
  }

  isManager(): boolean {
    return this.currentUserSubject.value?.role === 'manager';
  }

  loadUserFromToken(): void {
    const token = this.getToken();
    
    if (this.isLoadingUser) {
      return;
    }
    
    if (token) {
      if (this.currentUserSubject.value) {
        return;
      }

      this.isLoadingUser = true;
      
      this.loadUserSubscription = this.apiService.get<{ success: boolean; data: User }>('/auth/me').subscribe({
        next: (response) => {
          this.isLoadingUser = false;
          this.loadUserSubscription = null;
          
          if (response.success && response.data) {
            this.currentUserSubject.next(response.data);
          } else {
            localStorage.removeItem(this.tokenKey);
            this.currentUserSubject.next(null);
          }
        },
        error: (error) => {
          this.isLoadingUser = false;
          this.loadUserSubscription = null;
          
          if (error.status === 401 || error.status === 403) {
            localStorage.removeItem(this.tokenKey);
            this.currentUserSubject.next(null);
            if (!this.router.url.includes('/login')) {
              this.router.navigate(['/login']);
            }
          }
        }
      });
    } else {
      this.currentUserSubject.next(null);
    }
  }

  refreshUser(): void {
    this.loadUserFromToken();
  }

  changePassword(currentPassword: string | null, newPassword: string): Observable<any> {
    return this.apiService.post('/auth/change-password', {
      currentPassword,
      newPassword
    });
  }
}

