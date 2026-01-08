import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, NavigationEnd, Router } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { ChangePasswordModalComponent } from './components/shared/change-password-modal/change-password-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChangePasswordModalComponent],
  template: `
    <div class="app-container">
      <router-outlet></router-outlet>
      
      <!-- Change Password Modal - Global -->
      <app-change-password-modal
        *ngIf="showPasswordChangeModal"
        [requireCurrentPassword]="false"
        (passwordChanged)="onPasswordChanged()"
        (cancelled)="onPasswordChangeCancelled()">
      </app-change-password-modal>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      background-color: var(--bg-primary);
      transition: background-color 0.3s ease;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Redmine Compliance Dashboard';
  private routerSubscription?: Subscription;
  private userSubscription?: Subscription;
  showPasswordChangeModal: boolean = false;

  constructor(
    private themeService: ThemeService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.themeService.getCurrentTheme();

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      if (user?.mustChangePassword && !this.router.url.includes('/login')) {
        this.showPasswordChangeModal = true;
      } else if (!user?.mustChangePassword) {
        this.showPasswordChangeModal = false;
      }
    });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  onPasswordChanged(): void {
    this.showPasswordChangeModal = false;
    this.authService.refreshUser();
  }

  onPasswordChangeCancelled(): void {
    this.authService.logout();
  }
}
