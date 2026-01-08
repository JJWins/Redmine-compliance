import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="modal-overlay" (click)="onCancel()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">Change Password Required</h2>
          <p class="modal-subtitle">You must change your password before continuing.</p>
        </div>

        <form [formGroup]="passwordForm" (ngSubmit)="onSubmit()" class="modal-form">
          <div class="form-group" *ngIf="requireCurrentPassword">
            <label for="currentPassword" class="form-label">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              formControlName="currentPassword"
              class="form-input"
              [class.error]="passwordForm.get('currentPassword')?.invalid && passwordForm.get('currentPassword')?.touched"
              placeholder="Enter current password"
              autocomplete="current-password"
            />
            <div *ngIf="passwordForm.get('currentPassword')?.invalid && passwordForm.get('currentPassword')?.touched" class="error-message">
              <span *ngIf="passwordForm.get('currentPassword')?.errors?.['required']">Current password is required</span>
            </div>
          </div>

          <div class="form-group">
            <label for="newPassword" class="form-label">New Password</label>
            <input
              id="newPassword"
              type="password"
              formControlName="newPassword"
              class="form-input"
              [class.error]="passwordForm.get('newPassword')?.invalid && passwordForm.get('newPassword')?.touched"
              placeholder="Enter new password"
              autocomplete="new-password"
            />
            <div *ngIf="passwordForm.get('newPassword')?.invalid && passwordForm.get('newPassword')?.touched" class="error-message">
              <span *ngIf="passwordForm.get('newPassword')?.errors?.['required']">New password is required</span>
              <span *ngIf="passwordForm.get('newPassword')?.errors?.['minlength']">Password must be at least 8 characters</span>
            </div>
          </div>

          <div class="form-group">
            <label for="confirmPassword" class="form-label">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              formControlName="confirmPassword"
              class="form-input"
              [class.error]="passwordForm.get('confirmPassword')?.invalid && passwordForm.get('confirmPassword')?.touched"
              placeholder="Confirm new password"
              autocomplete="new-password"
            />
            <div *ngIf="passwordForm.get('confirmPassword')?.invalid && passwordForm.get('confirmPassword')?.touched" class="error-message">
              <span *ngIf="passwordForm.get('confirmPassword')?.errors?.['required']">Please confirm your new password</span>
              <span *ngIf="passwordForm.get('confirmPassword')?.errors?.['passwordMismatch']">Passwords do not match</span>
            </div>
          </div>

          <div *ngIf="errorMessage" class="error-alert">
            {{ errorMessage }}
          </div>

          <div class="modal-actions">
            <button
              type="button"
              class="btn-cancel"
              (click)="onCancel()"
              [disabled]="isLoading"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn-submit"
              [disabled]="passwordForm.invalid || isLoading"
            >
              <span *ngIf="!isLoading">Change Password</span>
              <span *ngIf="isLoading">Changing...</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 2rem;
    }

    .modal-content {
      background-color: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-header {
      padding: 2rem 2rem 1rem;
      border-bottom: 1px solid var(--border);
    }

    .modal-title {
      font-family: 'Sora', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .modal-subtitle {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .modal-form {
      padding: 2rem;
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

    .modal-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 2rem;
    }

    .btn-cancel,
    .btn-submit {
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'Sora', sans-serif;
    }

    .btn-cancel {
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }

    .btn-cancel:hover:not(:disabled) {
      background-color: var(--bg-tertiary);
      border-color: var(--text-secondary);
    }

    .btn-submit {
      background-color: var(--primary);
      color: white;
      border: none;
    }

    .btn-submit:hover:not(:disabled) {
      background-color: var(--primary-dark);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }

    .btn-cancel:disabled,
    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  `]
})
export class ChangePasswordModalComponent {
  @Input() requireCurrentPassword: boolean = false;
  @Output() passwordChanged = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  passwordForm: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.passwordForm = this.fb.group({
      currentPassword: ['', this.requireCurrentPassword ? [Validators.required] : []],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    
    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  onSubmit(): void {
    if (this.passwordForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { currentPassword, newPassword } = this.passwordForm.value;
    const currentPass = this.requireCurrentPassword ? currentPassword : null;

    this.authService.changePassword(currentPass, newPassword).subscribe({
      next: (response) => {
        if (response.success) {
          this.passwordChanged.emit();
        } else {
          this.errorMessage = response.message || 'Failed to change password';
          this.isLoading = false;
        }
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Failed to change password. Please try again.';
        this.isLoading = false;
      }
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}

