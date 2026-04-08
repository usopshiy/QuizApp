import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ProfileService, SessionResults } from '../../../core/services/profile.service';
import { LeaderboardComponent } from '../../../shared/components/leaderboard/leaderboard.component';

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    TableModule, ButtonModule, SkeletonModule, TagModule,
    LeaderboardComponent,
  ],
  template: `
    <div class="detail-page">
      <header class="detail-header">
        <p-button icon="pi pi-arrow-left" [text]="true" routerLink="/profile" />
        <div class="detail-title" *ngIf="results">
          <h2>{{ results.session.quiz_title }}</h2>
          <p>
            {{ results.session.ended_at | date:'medium' }} ·
            {{ results.leaderboard.length }} participants ·
            Code: <code>{{ results.session.join_code }}</code>
          </p>
        </div>
        <div class="export-actions" *ngIf="results">
          <p-button
            label="Export CSV"
            icon="pi pi-file"
            severity="secondary"
            [outlined]="true"
            (onClick)="ps.exportCsv(results!)"
          />
          <p-button
            label="Export PDF"
            icon="pi pi-file-pdf"
            severity="secondary"
            [outlined]="true"
            (onClick)="ps.exportPdf(results!)"
          />
        </div>
      </header>

      <!-- Loading -->
      <div *ngIf="loading" class="detail-main">
        <p-skeleton height="200px" styleClass="mb-4" />
        <p-skeleton height="400px" />
      </div>

      <div *ngIf="!loading && results" class="detail-main">

        <!-- Leaderboard -->
        <section class="detail-section">
          <h3>🏆 Leaderboard</h3>
          <app-leaderboard [entries]="results.leaderboard" />
        </section>

        <!-- Per-question breakdown -->
        <section class="detail-section">
          <h3>📊 Question Breakdown</h3>
          <div class="question-cards">
            <div *ngFor="let q of results.questions" class="question-result-card">
              <div class="qr-header">
                <span class="qr-num">Q{{ q.position + 1 }}</span>
                <span class="qr-body">{{ q.body || '(image question)' }}</span>
                <span class="qr-pct" [class.good]="q.correct_pct >= 50" [class.bad]="q.correct_pct < 50">
                  {{ q.correct_pct | number:'1.0-0' }}% correct
                </span>
              </div>
              <div class="qr-options">
                <div
                  *ngFor="let opt of q.options"
                  class="qr-option"
                  [class.correct]="q.correct_option_ids.includes(opt.id)"
                >
                  <i class="pi" [class.pi-check]="q.correct_option_ids.includes(opt.id)"
                    [class.pi-times]="!q.correct_option_ids.includes(opt.id)"></i>
                  {{ opt.body }}
                </div>
              </div>
              <div class="qr-stats">
                <span>{{ q.correct_count }} / {{ q.total_answers }} answered correctly</span>
                <span *ngIf="q.avg_response_ms">Avg: {{ q.avg_response_ms | number:'1.0-0' }}ms</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  `,
  styles: [`
    .detail-page { min-height: 100vh; background: var(--surface-ground); }
    .detail-header {
      display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
      padding: 1rem 2rem;
      background: var(--surface-card);
      border-bottom: 1px solid var(--surface-border);
    }
    .detail-title { flex: 1; }
    .detail-title h2 { margin: 0; font-size: 1.25rem; font-weight: 700; }
    .detail-title p  { margin: 0; color: var(--text-color-secondary); font-size: 0.875rem; }
    .export-actions { display: flex; gap: 0.5rem; }
    .detail-main { max-width: 1100px; margin: 0 auto; padding: 2rem; }
    .detail-section { margin-bottom: 2.5rem; }
    .detail-section h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; }
    .question-cards { display: flex; flex-direction: column; gap: 1rem; }
    .question-result-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 10px; padding: 1.25rem;
    }
    .qr-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
    .qr-num {
      background: var(--primary-color); color: white;
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem; font-weight: 700; flex-shrink: 0;
    }
    .qr-body { flex: 1; font-weight: 500; }
    .qr-pct { font-weight: 700; }
    .qr-pct.good { color: #22c55e; }
    .qr-pct.bad  { color: #ef4444; }
    .qr-options { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
    .qr-option {
      padding: 0.3rem 0.75rem; border-radius: 6px;
      font-size: 0.875rem; display: flex; align-items: center; gap: 0.4rem;
      background: var(--surface-ground);
    }
    .qr-option.correct { background: rgba(34,197,94,0.15); color: #16a34a; }
    .qr-stats { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-color-secondary); }
  `],
})
export class SessionDetailComponent implements OnInit {
  ps      = inject(ProfileService);
  private route = inject(ActivatedRoute);

  results: SessionResults | null = null;
  loading = true;

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get('sessionId')!;
    this.ps.getSessionResults(sessionId).subscribe({
      next:  (res) => { this.results = res; this.loading = false; },
      error: ()    => { this.loading = false; },
    });
  }
}