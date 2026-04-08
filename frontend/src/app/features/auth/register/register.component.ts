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
  selector: 'app-register',
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
            <h1>Create Account</h1>
            <p>Start hosting quizzes today</p>
          </div>
        </ng-template>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="displayName">Display Name</label>
            <input
              pInputText id="displayName"
              formControlName="displayName"
              placeholder="How you'll appear to others"
              class="w-full"
            />
          </div>

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
              placeholder="At least 8 characters"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            />
            <small
              *ngIf="form.get('password')?.invalid && form.get('password')?.dirty"
              class="p-error"
            >
              Password must be at least 8 characters
            </small>
          </div>

          <p-button
            type="submit"
            label="Create Account"
            icon="pi pi-user-plus"
            styleClass="w-full mt-2"
            [loading]="loading"
            [disabled]="form.invalid"
          />
        </form>

        <ng-template pTemplate="footer">
          <p class="auth-footer">
            Already have an account? <a routerLink="/login">Sign in</a>
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
    .auth-header { text-align: center; padding: 2rem 2rem 0; }
    .auth-logo { font-size: 2.5rem; }
    .auth-header h1 {
      margin: 0.5rem 0 0.25rem;
      font-size: 1.75rem;
      font-weight: 700;
    }
    .auth-header p { color: var(--text-color-secondary); margin: 0; }
    .field { margin-bottom: 1.25rem; }
    .field label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .auth-footer { text-align: center; color: var(--text-color-secondary); margin: 0; }
    .auth-footer a { color: var(--primary-color); text-decoration: none; font-weight: 500; }
  `],
})
export class RegisterComponent {
  private fb    = inject(FormBuilder);
  private auth  = inject(AuthService);
  private router = inject(Router);
  private toast  = inject(MessageService);

  loading = false;

  form = this.fb.group({
    displayName: ['', Validators.required],
    email:       ['', [Validators.required, Validators.email]],
    password:    ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;

    this.auth.register(this.form.value as any).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.loading = false;
        this.toast.add({
          severity: 'error',
          summary: 'Registration failed',
          detail: err.error?.error || 'Something went wrong',
        });
      },
    });
  }
}