import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>
            <h1>Geller Map</h1>
          </mat-card-title>
          <mat-card-subtitle>Mind Mapping Made Simple</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <p class="description">
            Visualize your ideas, organize your thoughts, and collaborate with your team using
            beautiful mind maps.
          </p>

          <div class="features">
            <div class="feature">
              <span class="icon">🧠</span>
              <span>Intuitive Mind Mapping</span>
            </div>
            <div class="feature">
              <span class="icon">🎨</span>
              <span>Beautiful Themes</span>
            </div>
            <div class="feature">
              <span class="icon">☁️</span>
              <span>Cloud Sync</span>
            </div>
          </div>
        </mat-card-content>

        <mat-card-actions>
          <button mat-raised-button color="primary" (click)="signIn()" class="google-btn">
            <img src="https://www.google.com/favicon.ico" alt="Google" class="google-icon" />
            Sign in with Google
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: `
    .login-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .login-card {
      max-width: 400px;
      width: 100%;
      text-align: center;
      padding: 32px;
    }

    h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .description {
      margin: 24px 0;
      color: rgba(0, 0, 0, 0.6);
      line-height: 1.6;
    }

    .features {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 24px 0;
    }

    .feature {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 8px;
    }

    .icon {
      font-size: 20px;
    }

    mat-card-actions {
      display: flex;
      justify-content: center;
      padding: 16px !important;
    }

    .google-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
    }

    .google-icon {
      width: 18px;
      height: 18px;
    }
  `,
})
export class LoginComponent {
  private authService = inject(AuthService);

  async signIn(): Promise<void> {
    try {
      await this.authService.signInWithGoogle();
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  }
}
