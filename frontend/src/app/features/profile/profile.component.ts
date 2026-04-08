import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService, OrganizerSession, ParticipantSession } from '../../core/services/profile.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    TabViewModule, TableModule, ButtonModule, TagModule, SkeletonModule,
  ],
  template: `
    <div class="profile-page">
      <header class="profile-header">
        <p-button icon="pi pi-arrow-left" [text]="true" routerLink="/dashboard" />
        <div class="profile-title">
          <h2>Personal Cabinet</h2>
          <p>{{ auth.currentUser()?.display_name }} · {{ auth.currentUser()?.email }}</p>
        </div>
      </header>

      <main class="profile-main">
        <p-tabView>

          <!-- ── ORGANIZER TAB ── -->
          <p-tabPanel header="Quiz History" leftIcon="pi pi-list">
            <div *ngIf="orgLoading" class="skeleton-list">
              <p-skeleton height="3rem" *ngFor="let i of [1,2,3]" styleClass="mb-2" />
            </div>

            <div *ngIf="!orgLoading && orgSessions.length === 0" class="empty-state">
              <i class="pi pi-history"></i>
              <p>No completed quiz sessions yet</p>
            </div>

            <p-table
              *ngIf="!orgLoading && orgSessions.length > 0"
              [value]="orgSessions"
              [paginator]="orgSessions.length > 10"
              [rows]="10"
              styleClass="p-datatable-sm"
            >
              <ng-template pTemplate="header">
                <tr>
                  <th>Quiz Title</th>
                  <th style="width:140px">Date</th>
                  <th style="width:110px">Duration</th>
                  <th style="width:120px">Participants</th>
                  <th style="width:110px">Top Score</th>
                  <th style="width:120px">Actions</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-s>
                <tr>
                  <td>
                    <span class="session-title">{{ s.quiz_title }}</span>
                    <span class="session-code">{{ s.join_code }}</span>
                  </td>
                  <td>{{ s.ended_at | date:'mediumDate' }}</td>
                  <td>{{ duration(s.started_at, s.ended_at) }}</td>
                  <td>{{ s.participant_count }}</td>
                  <td>
                    <strong>{{ s.top_score }}</strong>
                  </td>
                  <td>
                    <p-button
                      label="View Results"
                      icon="pi pi-chart-bar"
                      [text]="true"
                      size="small"
                      [routerLink]="['/profile/sessions', s.session_id]"
                    />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </p-tabPanel>

          <!-- ── PARTICIPANT TAB ── -->
          <p-tabPanel header="Participation History" leftIcon="pi pi-user">
            <div *ngIf="partLoading" class="skeleton-list">
              <p-skeleton height="3rem" *ngFor="let i of [1,2,3]" styleClass="mb-2" />
            </div>

            <div *ngIf="!partLoading && partSessions.length === 0" class="empty-state">
              <i class="pi pi-play-circle"></i>
              <p>You haven't participated in any quizzes yet</p>
              <p-button label="Join a Quiz" icon="pi pi-play" routerLink="/join" />
            </div>

            <p-table
              *ngIf="!partLoading && partSessions.length > 0"
              [value]="partSessions"
              [paginator]="partSessions.length > 10"
              [rows]="10"
              styleClass="p-datatable-sm"
            >
              <ng-template pTemplate="header">
                <tr>
                  <th>Quiz</th>
                  <th style="width:140px">Date</th>
                  <th style="width:100px">Name</th>
                  <th style="width:100px">Score</th>
                  <th style="width:110px">Rank</th>
                  <th style="width:120px">Correct</th>
                  <th style="width:80px">Source</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-s>
                <tr>
                  <td>{{ s.quiz_title }}</td>
                  <td>{{ s.ended_at | date:'mediumDate' }}</td>
                  <td>{{ s.display_name }}</td>
                  <td><strong>{{ s.score }}</strong></td>
                  <td>#{{ s.rank }}</td>
                  <td>{{ s.correct_answers }} / {{ s.questions_answered }}</td>
                  <td>
                    <p-tag
                      [value]="s.source === 'db' ? 'Account' : 'Guest'"
                      [severity]="s.source === 'db' ? 'success' : 'secondary'"
                    />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </p-tabPanel>

        </p-tabView>
      </main>
    </div>
  `,
  styles: [`
    .profile-page { min-height: 100vh; background: var(--surface-ground); }
    .profile-header {
      display: flex; align-items: center; gap: 1rem;
      padding: 1rem 2rem;
      background: var(--surface-card);
      border-bottom: 1px solid var(--surface-border);
    }
    .profile-title h2 { margin: 0; font-size: 1.25rem; font-weight: 700; }
    .profile-title p  { margin: 0; color: var(--text-color-secondary); font-size: 0.875rem; }
    .profile-main { max-width: 1100px; margin: 0 auto; padding: 2rem; }
    .session-title { font-weight: 600; display: block; }
    .session-code  { font-size: 0.75rem; color: var(--text-color-secondary); font-family: monospace; }
    .empty-state {
      text-align: center; padding: 3rem;
      color: var(--text-color-secondary);
    }
    .empty-state i { font-size: 2.5rem; margin-bottom: 1rem; display: block; }
    .skeleton-list { display: flex; flex-direction: column; gap: 0.5rem; }
  `],
})
export class ProfileComponent implements OnInit {
  auth    = inject(AuthService);
  private ps = inject(ProfileService);

  orgSessions:  OrganizerSession[]  = [];
  partSessions: ParticipantSession[] = [];
  orgLoading   = true;
  partLoading  = true;

  ngOnInit(): void {
    this.ps.getOrganizerSessions().subscribe({
      next:  (res) => { this.orgSessions = res.sessions; this.orgLoading = false; },
      error: ()    => { this.orgLoading  = false; },
    });

    this.ps.getParticipantSessions().subscribe({
      next:  (res) => { this.partSessions = res; this.partLoading = false; },
      error: ()    => { this.partLoading  = false; },
    });
  }

  duration(start: string | null, end: string | null): string {
    if (!start || !end) return '—';
    const ms  = new Date(end).getTime() - new Date(start).getTime();
    if (ms <= 0) return '—';
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  }
}