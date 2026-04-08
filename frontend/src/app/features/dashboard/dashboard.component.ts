import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { QuizService, Quiz } from '../../core/services/quiz.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    TableModule, ButtonModule, TagModule, SkeletonModule, ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  template: `
    <div class="dashboard-page">
      <p-confirmDialog />

      <header class="dash-header">
        <div class="dash-header-left">
          <span class="dash-logo">⚡</span>
          <h1>QuizPlatform</h1>
        </div>
        <div class="dash-header-right">
          <p-button
            label="Join Quiz"
            icon="pi pi-play"
            severity="secondary"
            [outlined]="true"
            routerLink="/join"
          />
          <p-button
            label="Profile"
            icon="pi pi-user"
            severity="secondary"
            [outlined]="true"
            routerLink="/profile"
          />
          <p-button
            label="Sign Out"
            icon="pi pi-sign-out"
            severity="secondary"
            [text]="true"
            (onClick)="auth.logout()"
          />
        </div>
      </header>

      <main class="dash-main">
        <div class="dash-title-row">
          <div>
            <h2>My Quizzes</h2>
            <p>Welcome back, {{ auth.currentUser()?.display_name }}</p>
          </div>
          <p-button
            label="New Quiz"
            icon="pi pi-plus"
            routerLink="/quiz/new"
          />
        </div>

        <!-- Loading skeletons -->
        <div *ngIf="loading" class="skeleton-list">
          <p-skeleton height="3.5rem" *ngFor="let i of [1,2,3]" styleClass="mb-2" />
        </div>

        <!-- Empty state -->
        <div *ngIf="!loading && quizzes.length === 0" class="empty-state">
          <i class="pi pi-question-circle" style="font-size: 3rem; color: var(--text-color-secondary)"></i>
          <h3>No quizzes yet</h3>
          <p>Create your first quiz to get started</p>
          <p-button label="Create Quiz" icon="pi pi-plus" routerLink="/quiz/new" />
        </div>

        <!-- Quiz table -->
        <p-table
          *ngIf="!loading && quizzes.length > 0"
          [value]="quizzes"
          [paginator]="quizzes.length > 10"
          [rows]="10"
          styleClass="p-datatable-sm"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Title</th>
              <th style="width:120px">Status</th>
              <th style="width:100px">Questions</th>
              <th style="width:160px">Created</th>
              <th style="width:220px">Actions</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-quiz>
            <tr>
              <td>
                <span class="quiz-title">{{ quiz.title }}</span>
                <span class="join-code">{{ quiz.join_code }}</span>
              </td>
              <td>
                <p-tag
                  [value]="quiz.status | titlecase"
                  [severity]="statusSeverity(quiz.status)"
                />
              </td>
              <td>{{ quiz.question_count }}</td>
              <td>{{ quiz.created_at | date:'mediumDate' }}</td>
              <td>
                <div class="action-buttons">
                  <p-button
                    icon="pi pi-pencil"
                    severity="secondary"
                    [text]="true"
                    pTooltip="Edit"
                    [routerLink]="['/quiz', quiz.id, 'edit']"
                  />
                  <p-button
                    icon="pi pi-play"
                    severity="success"
                    [text]="true"
                    pTooltip="Start"
                    [disabled]="quiz.status === 'active' || quiz.question_count === 0"
                    (onClick)="startQuiz(quiz)"
                  />
                  <p-button
                    icon="pi pi-trash"
                    severity="danger"
                    [text]="true"
                    pTooltip="Delete"
                    (onClick)="confirmDelete(quiz)"
                  />
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </main>
    </div>
  `,
  styles: [`
    .dashboard-page {
      min-height: 100vh;
      background: var(--surface-ground);
    }
    .dash-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 2rem;
      background: var(--surface-card);
      border-bottom: 1px solid var(--surface-border);
    }
    .dash-header-left { display: flex; align-items: center; gap: 0.75rem; }
    .dash-logo { font-size: 1.5rem; }
    .dash-header-left h1 { margin: 0; font-size: 1.25rem; font-weight: 700; }
    .dash-header-right { display: flex; gap: 0.5rem; }
    .dash-main { max-width: 1100px; margin: 0 auto; padding: 2rem; }
    .dash-title-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .dash-title-row h2 { margin: 0 0 0.25rem; font-size: 1.5rem; font-weight: 700; }
    .dash-title-row p { margin: 0; color: var(--text-color-secondary); }
    .quiz-title { font-weight: 600; display: block; }
    .join-code {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      font-family: monospace;
      letter-spacing: 0.1em;
    }
    .action-buttons { display: flex; gap: 0.25rem; }
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: var(--text-color-secondary);
    }
    .empty-state h3 { margin: 1rem 0 0.5rem; color: var(--text-color); }
    .empty-state p { margin: 0 0 1.5rem; }
    .skeleton-list { display: flex; flex-direction: column; gap: 0.5rem; }
  `],
})
export class DashboardComponent implements OnInit {
  auth        = inject(AuthService);
  private qs  = inject(QuizService);
  private router = inject(Router);
  private confirm = inject(ConfirmationService);
  private toast   = inject(MessageService);

  quizzes: Quiz[] = [];
  loading = true;

  ngOnInit(): void {
    this.qs.listQuizzes().subscribe({
      next:  (res) => { this.quizzes = res.quizzes; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  statusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      draft: 'secondary', active: 'success', ended: 'info', archived: 'danger',
    };
    return map[status] ?? 'secondary';
  }

  startQuiz(quiz: Quiz): void {
    this.qs.startSession(quiz.id).subscribe({
      next: (res) => this.router.navigate(['/quiz', quiz.id, 'host', res.session.id]),
      error: (err) => this.toast.add({
        severity: 'error', summary: 'Error', detail: err.error?.error || 'Could not start quiz',
      }),
    });
  }

  confirmDelete(quiz: Quiz): void {
    this.confirm.confirm({
      message: `Delete "${quiz.title}"? This cannot be undone.`,
      header: 'Delete Quiz',
      icon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.qs.deleteQuiz(quiz.id).subscribe({
          next: () => {
            this.quizzes = this.quizzes.filter((q) => q.id !== quiz.id);
            this.toast.add({ severity: 'success', summary: 'Deleted', detail: `"${quiz.title}" removed` });
          },
        });
      },
    });
  }
}