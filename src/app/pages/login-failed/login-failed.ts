import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-login-failed',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, RouterLink],
  template: `
    <div class="login-failed-page container py-5">
      <mat-card class="mx-auto login-failed-card" appearance="outlined">
        <mat-card-content class="text-center py-4">
          <mat-icon class="text-danger mb-2 login-failed-icon">error_outline</mat-icon>
          <h1 class="h5">Sign-in failed</h1>
          <p class="text-body-secondary small mb-4">
            Microsoft sign-in did not complete. Try again or contact your administrator.
          </p>
          <button mat-flat-button color="primary" type="button" (click)="retryLogin()">
            Try again
          </button>
          <a mat-button routerLink="/" class="ms-2">Home</a>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .login-failed-page {
      max-width: 480px;
      margin: 0 auto;
    }
    .login-failed-card {
      max-width: 28rem;
    }
    .login-failed-icon {
      font-size: 3rem;
      width: 3rem;
      height: 3rem;
    }
  `,
})
export class LoginFailed {
  private msal = inject(MsalService);

  retryLogin(): void {
    this.msal.loginRedirect();
  }
}
