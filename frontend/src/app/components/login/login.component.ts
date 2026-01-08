import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ChangePasswordModalComponent } from '../shared/change-password-modal/change-password-modal.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ChangePasswordModalComponent],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1 class="login-title">Redmine Compliance Dashboard</h1>
          <p class="login-subtitle">Sign in to your account</p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="email" class="form-label">Email Address</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              class="form-input"
              [class.error]="loginForm.get('email')?.invalid && loginForm.get('email')?.touched"
              placeholder="Enter your email"
              autocomplete="email"
            />
            <div *ngIf="loginForm.get('email')?.invalid && loginForm.get('email')?.touched" class="error-message">
              <span *ngIf="loginForm.get('email')?.errors?.['required']">Email is required</span>
              <span *ngIf="loginForm.get('email')?.errors?.['email']">Please enter a valid email</span>
            </div>
          </div>

          <div class="form-group">
            <label for="password" class="form-label">Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              class="form-input"
              [class.error]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
              placeholder="Enter your password"
              autocomplete="current-password"
            />
            <div *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched" class="error-message">
              <span *ngIf="loginForm.get('password')?.errors?.['required']">Password is required</span>
            </div>
          </div>

          <div *ngIf="errorMessage" class="error-alert">
            {{ errorMessage }}
          </div>

          <button
            type="submit"
            class="login-button"
            [disabled]="loginForm.invalid || isLoading"
          >
            <span *ngIf="!isLoading">Sign In</span>
            <span *ngIf="isLoading">Signing in...</span>
          </button>
        </form>

        <div class="login-footer">
          <div class="demo-credentials">
            <p class="demo-title">Demo Credentials:</p>
            <div class="credential-item">
              <strong>Admin:</strong> admin&#64;polussolutions.com / admin123
            </div>
            <div class="credential-item">
              <strong>Manager:</strong> manager&#64;polussolutions.com / manager123
            </div>
          </div>
        </div>
      </div>

      <!-- Change Password Modal -->
      <app-change-password-modal
        *ngIf="showPasswordChangeModal"
        [requireCurrentPassword]="false"
        (passwordChanged)="onPasswordChanged()"
        (cancelled)="showPasswordChangeModal = false">
      </app-change-password-modal>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--bg-primary);
      padding: 2rem;
    }

    .login-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      padding: 3rem;
      width: 100%;
      max-width: 420px;
    }

    .login-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .login-title {
      font-family: 'Sora', sans-serif;
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .login-subtitle {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .login-form {
      margin-bottom: 2rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .form-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 1rem;
      transition: all 0.2s;
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      box-sizing: border-box;
    }

    .form-input::placeholder {
      color: var(--text-tertiary);
    }

    .form-input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .form-input.error {
      border-color: var(--danger);
    }

    .error-message {
      color: var(--danger);
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .error-alert {
      background-color: var(--danger-bg);
      color: var(--danger);
      padding: 0.75rem 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }

    .login-button {
      width: 100%;
      padding: 0.75rem 1rem;
      background-color: var(--primary);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'Sora', sans-serif;
    }

    .login-button:hover:not(:disabled) {
      background-color: var(--primary-dark);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }

    .login-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .login-footer {
      border-top: 1px solid var(--border);
      padding-top: 1.5rem;
    }

    .demo-credentials {
      text-align: center;
    }

    .demo-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .credential-item {
      font-size: 0.875rem;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
      padding: 0.75rem;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
    }

    .credential-item strong {
      color: var(--primary);
    }
  `]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;
  returnUrl: string = '/';
  showPasswordChangeModal: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    
    if (this.authService.isAuthenticated() && this.authService.isUserLoaded()) {
      this.router.navigate([this.returnUrl]);
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (response) => {
        if (response.success) {
          if (response.data.mustChangePassword) {
            this.isLoading = false;
            this.showPasswordChangeModal = true;
          } else {
            this.router.navigate([this.returnUrl]);
          }
        } else {
          this.errorMessage = 'Invalid email or password';
          this.isLoading = false;
        }
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Login failed. Please try again.';
        this.isLoading = false;
      }
    });
  }

  onPasswordChanged(): void {
    this.showPasswordChangeModal = false;
    this.authService.refreshUser();
    this.router.navigate([this.returnUrl]);
  }
}

