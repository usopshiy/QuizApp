import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    CardModule, InputTextModule, PasswordModule, ButtonModule,
  ],
  template: `
    <div class="auth-page">
      <p-card styleClass="auth-card">
        <ng-template pTemplate="header">
          <div class="auth-header">
            <span class="auth-logo">⚡</span>
            <h1>QuizPlatform</h1>
            <p>Sign in to your account</p>
          </div>
        </ng-template>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="email">Email</label>
            <input
              pInputText id="email" type="email"
              formControlName="email"
              placeholder="you@example.com"
              class="w-full"
            />
          </div>

          <div class="field">
            <label for="password">Password</label>
            <p-password
              inputId="password"
              formControlName="password"
              placeholder="Your password"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            />
          </div>

          <p-button
            type="submit"
            label="Sign In"
            icon="pi pi-sign-in"
            styleClass="w-full mt-2"
            [loading]="loading"
            [disabled]="form.invalid"
          />
        </form>

        <ng-template pTemplate="footer">
          <p class="auth-footer">
            No account? <a routerLink="/register">Create one</a>
          </p>
        </ng-template>
      </p-card>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-ground);
    }
    .auth-card { width: 100%; max-width: 420px; }
    .auth-header {
      text-align: center;
      padding: 2rem 2rem 0;
    }
    .auth-logo { font-size: 2.5rem; }
    .auth-header h1 {
      margin: 0.5rem 0 0.25rem;
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-color);
    }
    .auth-header p { color: var(--text-color-secondary); margin: 0; }
    .field { margin-bottom: 1.25rem; }
    .field label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: var(--text-color);
    }
    .auth-footer {
      text-align: center;
      color: var(--text-color-secondary);
      margin: 0;
    }
    .auth-footer a { color: var(--primary-color); text-decoration: none; font-weight: 500; }
  `],
})
export class LoginComponent {
  private fb      = inject(FormBuilder);
  private auth    = inject(AuthService);
  private router  = inject(Router);
  private toast   = inject(MessageService);

  loading = false;

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;

    this.auth.login(this.form.value as any).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.loading = false;
        this.toast.add({
          severity: 'error',
          summary: 'Login failed',
          detail: err.error?.error || 'Invalid credentials',
        });
      },
    });
  }
}