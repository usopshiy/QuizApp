import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/services/auth.service';
import { SocketService } from '../../../core/services/socket.service';
import { saveAnonymousSession } from '../../../core/services/profile.service';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CardModule, InputTextModule, ButtonModule],
  template: `
    <div class="join-page">
      <p-card styleClass="join-card">
        <ng-template pTemplate="header">
          <div class="join-header">
            <span class="join-logo">⚡</span>
            <h1>Join Quiz</h1>
            <p *ngIf="auth.isLoggedIn()">
              Playing as <strong>{{ auth.currentUser()?.display_name }}</strong>
            </p>
            <p *ngIf="!auth.isLoggedIn()">Enter your name and the quiz code</p>
          </div>
        </ng-template>

        <form [formGroup]="form" (ngSubmit)="join()">
          <div class="field">
            <label>Quiz Code</label>
            <input
              pInputText formControlName="joinCode"
              placeholder="e.g. AB3X9F"
              class="w-full join-code-input"
              (input)="toUpper($event)"
            />
          </div>

          <div class="field" *ngIf="!auth.isLoggedIn()">
            <label>Your Name</label>
            <input
              pInputText formControlName="displayName"
              placeholder="How others will see you"
              class="w-full"
            />
          </div>

          <p-button
            type="submit"
            label="Join Game"
            icon="pi pi-play"
            styleClass="w-full"
            [loading]="joining"
            [disabled]="form.invalid"
          />
        </form>

        <ng-template pTemplate="footer">
          <div class="join-footer">
            <a href="/login" *ngIf="!auth.isLoggedIn()">Sign in to track your history</a>
          </div>
        </ng-template>
      </p-card>
    </div>
  `,
  styles: [`
    .join-page {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: #0f172a;
    }
    .join-card { width: 100%; max-width: 400px; }
    .join-header { text-align: center; padding: 2rem 2rem 0; }
    .join-logo { font-size: 2.5rem; }
    .join-header h1 { margin: 0.5rem 0 0.25rem; font-size: 1.75rem; font-weight: 700; }
    .join-header p { color: var(--text-color-secondary); margin: 0; }
    .field { margin-bottom: 1.25rem; }
    .field label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .join-code-input {
      font-family: monospace; letter-spacing: 0.2em;
      font-size: 1.5rem; text-align: center; text-transform: uppercase;
    }
    .join-footer { text-align: center; }
    .join-footer a { color: var(--primary-color); text-decoration: none; font-size: 0.875rem; }
  `],
})
export class JoinComponent implements OnInit {
  auth    = inject(AuthService);
  private fb     = inject(FormBuilder);
  private socket = inject(SocketService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private toast  = inject(MessageService);

  joining = false;
  private pendingSessionId = '';

  form = this.fb.group({
    joinCode:    ['', [Validators.required, Validators.minLength(4)]],
    displayName: [''],
  });

  ngOnInit(): void {
    // Pre-fill code from query param (?code=ABC123)
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) this.form.patchValue({ joinCode: code.toUpperCase() });

    // If logged in, display name is not required
    if (this.auth.isLoggedIn()) {
      this.form.get('displayName')?.clearValidators();
    } else {
      this.form.get('displayName')?.setValidators(Validators.required);
    }
    this.form.get('displayName')?.updateValueAndValidity();

    this.socket.connect();

    this.socket.onParticipantJoined().subscribe((e: any) => {
      this.router.navigate(['/play', e.sessionId]);
    });

    this.socket.onRejoined().subscribe((e: any) => {
      this.router.navigate(['/play', e.sessionId]);
    });

    this.socket.onError().subscribe((e) => {
      this.joining = false;
      this.toast.add({ severity: 'error', summary: 'Could not join', detail: e.message });
    });
  }

  join(): void {
    if (this.form.invalid) return;
    this.joining = true;

    const joinCode    = this.form.value.joinCode!.toUpperCase();
    const displayName = this.auth.isLoggedIn()
      ? this.auth.currentUser()!.display_name
      : this.form.value.displayName!;
    const token       = this.auth.token() ?? undefined;

    // Store in localStorage if anonymous (for participation history)
    if (!this.auth.isLoggedIn()) {
      // We'll save after we know the sessionId — wired in play component
      sessionStorage.setItem('pending_join_name', displayName);
      sessionStorage.setItem('pending_join_code', joinCode);
    }

    this.socket.participantJoin(joinCode, displayName, token);
  }

  toUpper(event: any): void {
    event.target.value = event.target.value.toUpperCase();
    this.form.patchValue({ joinCode: event.target.value });
  }
}