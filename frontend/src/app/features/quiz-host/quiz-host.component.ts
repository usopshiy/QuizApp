import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageService } from 'primeng/api';
import { SocketService, QuestionEvent, QuestionEndedEvent, SessionEndedEvent } from '../../core/services/socket.service';
import { AuthService } from '../../core/services/auth.service';
import { QuizService } from '../../core/services/quiz.service';
import { LeaderboardComponent } from '../../shared/components/leaderboard/leaderboard.component';
import { CountdownTimerComponent } from '../../shared/components/countdown-timer/countdown-timer.component';

type HostView = 'lobby' | 'question' | 'question-results' | 'ended';

@Component({
  selector: 'app-quiz-host',
  standalone: true,
  imports: [
    CommonModule, ButtonModule, CardModule, TagModule,
    ChartModule, TableModule, ProgressBarModule,
    LeaderboardComponent, CountdownTimerComponent,
  ],
  template: `
    <!-- LOBBY -->
    <div *ngIf="view === 'lobby'" class="host-page">
      <div class="host-container">
        <div class="lobby-header">
          <h1>Waiting for players…</h1>
          <div class="join-code-display">
            <span class="join-label">Join at <strong>quizplatform.app</strong> with code</span>
            <span class="join-code">{{ joinCode }}</span>
          </div>
        </div>

        <div class="participants-grid">
          <div *ngFor="let p of participants" class="participant-chip">
            {{ p.display_name }}
          </div>
          <div *ngIf="participants.length === 0" class="waiting-hint">
            Share the code — participants will appear here
          </div>
        </div>

        <div class="lobby-footer">
          <span class="participant-count">{{ participants.length }} joined</span>
          <p-button
            label="Start Quiz"
            icon="pi pi-play"
            size="large"
            [disabled]="participants.length === 0"
            (onClick)="nextQuestion()"
          />
        </div>
      </div>
    </div>

    <!-- ACTIVE QUESTION -->
    <div *ngIf="view === 'question'" class="host-page">
      <div class="host-container">
        <div class="question-header">
          <span class="q-progress">Question {{ (currentQuestion?.index ?? 0) + 1 }} of {{ currentQuestion?.totalQuestions }}</span>
          <app-countdown-timer
            *ngIf="currentQuestion?.timeLimitSec"
            [seconds]="currentQuestion!.timeLimitSec!"
            (finished)="nextQuestion()"
          />
        </div>

        <div class="question-body">
          <img *ngIf="currentQuestion?.question?.image_url"
            [src]="currentQuestion!.question.image_url"
            class="question-image" alt="Question image" />
          <h2>{{ currentQuestion?.question?.body }}</h2>
        </div>

        <div class="answer-options host-options">
          <div
            *ngFor="let opt of currentQuestion?.question?.options; let i = index"
            class="host-option"
            [class]="'host-option-' + i"
          >
            {{ opt.body }}
          </div>
        </div>

        <div class="live-answers">
          <h4>Live responses: {{ answeredCount }} / {{ participants.length }}</h4>
          <p-progressBar [value]="answerProgress" [showValue]="false" />
        </div>

        <div class="host-actions">
          <p-button
            label="Next Question"
            icon="pi pi-arrow-right"
            (onClick)="nextQuestion()"
          />
        </div>
      </div>
    </div>

    <!-- QUESTION RESULTS -->
    <div *ngIf="view === 'question-results'" class="host-page">
      <div class="host-container">
        <h2 class="results-title">Results</h2>

        <div *ngIf="questionEndedData" class="results-chart">
          <p-chart type="bar" [data]="chartData" [options]="chartOptions" />
        </div>

        <div class="results-stats" *ngIf="questionEndedData?.stats">
          <div class="stat-box">
            <span class="stat-value">{{ questionEndedData!.stats!.correct_pct }}%</span>
            <span class="stat-label">Correct</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">{{ questionEndedData!.stats!.total_answers }}</span>
            <span class="stat-label">Answered</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">{{ questionEndedData!.stats!.avg_response_ms | number:'1.0-0' }}ms</span>
            <span class="stat-label">Avg Time</span>
          </div>
        </div>

        <p-button
          [label]="isLastQuestion ? 'Show Final Results' : 'Next Question'"
          icon="pi pi-arrow-right"
          (onClick)="nextQuestion()"
        />
      </div>
    </div>

    <!-- SESSION ENDED -->
    <div *ngIf="view === 'ended'" class="host-page">
      <div class="host-container">
        <h1>🏆 Final Results</h1>
        <app-leaderboard [entries]="leaderboard" />
        <p-button
          label="Back to Dashboard"
          icon="pi pi-home"
          styleClass="mt-4"
          (onClick)="goHome()"
        />
      </div>
    </div>
  `,
  styles: [`
    .host-page {
      min-height: 100vh;
      background: #0f172a;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .host-container { width: 100%; max-width: 900px; }
    .lobby-header { text-align: center; margin-bottom: 2rem; }
    .lobby-header h1 { font-size: 2rem; margin-bottom: 1rem; }
    .join-code-display { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
    .join-label { color: #94a3b8; font-size: 1rem; }
    .join-code {
      font-size: 4rem; font-weight: 900; letter-spacing: 0.2em;
      color: #38bdf8; font-family: monospace;
    }
    .participants-grid {
      display: flex; flex-wrap: wrap; gap: 0.75rem;
      justify-content: center; min-height: 80px;
      padding: 1.5rem; background: rgba(255,255,255,0.05);
      border-radius: 12px; margin-bottom: 2rem;
    }
    .participant-chip {
      background: rgba(56,189,248,0.15); border: 1px solid #38bdf8;
      color: #e2e8f0; padding: 0.4rem 1rem; border-radius: 99px;
      font-size: 0.9rem;
    }
    .waiting-hint { color: #64748b; align-self: center; }
    .lobby-footer { display: flex; align-items: center; justify-content: space-between; }
    .participant-count { color: #94a3b8; font-size: 1.1rem; }
    .question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .q-progress { color: #94a3b8; font-size: 1rem; }
    .question-body { text-align: center; margin-bottom: 2rem; }
    .question-body h2 { font-size: 1.75rem; }
    .question-image { max-height: 200px; border-radius: 12px; margin-bottom: 1rem; }
    .host-options { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; }
    .host-option {
      padding: 1rem 1.5rem; border-radius: 10px; font-size: 1.1rem; font-weight: 600;
      display: flex; align-items: center;
    }
    .host-option-0 { background: #ef4444; }
    .host-option-1 { background: #3b82f6; }
    .host-option-2 { background: #22c55e; }
    .host-option-3 { background: #f59e0b; }
    .live-answers { margin-bottom: 2rem; }
    .live-answers h4 { margin: 0 0 0.75rem; color: #94a3b8; }
    .host-actions { display: flex; justify-content: center; }
    .results-title { text-align: center; font-size: 1.75rem; margin-bottom: 1.5rem; }
    .results-chart { margin-bottom: 2rem; }
    .results-stats { display: flex; justify-content: center; gap: 3rem; margin-bottom: 2rem; }
    .stat-box { text-align: center; }
    .stat-value { display: block; font-size: 2.5rem; font-weight: 800; color: #38bdf8; }
    .stat-label { color: #94a3b8; font-size: 0.9rem; }
  `],
})
export class QuizHostComponent implements OnInit, OnDestroy {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private socket = inject(SocketService);
  private auth   = inject(AuthService);
  private toast  = inject(MessageService);
  private quizSvc = inject(QuizService);

  private subs = new Subscription();

  view:        HostView = 'lobby';
  sessionId!:  string;
  quizId!:     string;
  joinCode     = '';
  participants: { id: string; display_name: string }[] = [];
  answeredCount = 0;

  currentQuestion: QuestionEvent | null = null;
  questionEndedData: QuestionEndedEvent | null = null;
  leaderboard: any[] = [];
  isLastQuestion = false;

  chartData:    any = {};
  chartOptions  = {
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.1)' } },
      x: { ticks: { color: '#e2e8f0' }, grid: { display: false } },
    },
  };

  get answerProgress(): number {
    if (!this.participants.length) return 0;
    return Math.round((this.answeredCount / this.participants.length) * 100);
  }

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.paramMap.get('sessionId')!;
    this.quizId    = this.route.snapshot.paramMap.get('id')!;

    this.socket.connect();
    this.socket.hostJoin(this.sessionId, this.auth.token()!);

    this.subs.add(
      this.socket.onParticipantJoined().subscribe((e) => {
        this.participants = [...this.participants, e.participant];
      })
    );

    this.subs.add(
      this.socket.onQuestion().subscribe((e) => {
        this.currentQuestion  = e;
        this.answeredCount    = 0;
        this.isLastQuestion   = e.index === e.totalQuestions - 1;
        this.view             = 'question';
      })
    );

    this.subs.add(
      this.socket.onQuestionEnded().subscribe((e) => {
        this.questionEndedData = e;
        this.buildChart(e);
        this.view = 'question-results';
      })
    );

    this.subs.add(
      this.socket.onSessionEnded().subscribe((e) => {
        this.leaderboard = e.leaderboard;
        this.view        = 'ended';
      })
    );

    this.subs.add(
      this.socket.onAnswerReceived().subscribe(() => {
        this.answeredCount++;
      })
    );

    this.subs.add(
      this.socket.onError().subscribe((e) => {
        this.toast.add({ severity: 'error', summary: 'Error', detail: e.message });
      })
    );

    this.quizSvc.getSession(this.quizId, this.sessionId).subscribe((res) => {
      const s = res.session;
      this.joinCode = s.join_code ?? '';

      // Restore view state based on current session status
      if (s.status === 'question')  this.view = 'question';
      if (s.status === 'results')   this.view = 'question-results';
      if (s.status === 'finished')  {
        this.view = 'ended';
      // Re-fetch leaderboard
        this.quizSvc.getLeaderboard(this.quizId, this.sessionId).subscribe((lb) => {
        this.leaderboard = lb.leaderboard;
      });
  }
});
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.socket.disconnect();
  }

  nextQuestion(): void {
    this.socket.hostNext(this.sessionId);
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  private buildChart(e: QuestionEndedEvent): void {
    if (!this.currentQuestion) return;
    const opts    = this.currentQuestion.question.options;
    const correct = new Set(e.correctOptionIds);

    this.chartData = {
      labels: opts.map((o) => o.body),
      datasets: [{
        data:            opts.map(() => Math.floor(Math.random() * 10)), // placeholder — replace with real per-option counts if added to backend
        backgroundColor: opts.map((o) => correct.has(o.id) ? '#22c55e' : '#ef4444'),
      }],
    };
  }
}