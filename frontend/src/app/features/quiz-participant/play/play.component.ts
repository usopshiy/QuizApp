import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageService } from 'primeng/api';
import { SocketService, QuestionEvent, QuestionEndedEvent } from '../../../core/services/socket.service';
import { AuthService } from '../../../core/services/auth.service';
import { saveAnonymousSession } from '../../../core/services/profile.service';
import { LeaderboardComponent } from '../../../shared/components/leaderboard/leaderboard.component';
import { CountdownTimerComponent } from '../../../shared/components/countdown-timer/countdown-timer.component';

type PlayView = 'waiting' | 'question' | 'answer-feedback' | 'intermission' | 'ended';

@Component({
  selector: 'app-play',
  standalone: true,
  imports: [CommonModule, ButtonModule, ProgressBarModule, LeaderboardComponent, CountdownTimerComponent],
  template: `
    <!-- WAITING FOR QUIZ TO START -->
    <div *ngIf="view === 'waiting'" class="play-page waiting">
      <div class="waiting-inner">
        <span class="play-logo">⚡</span>
        <h2>You're in!</h2>
        <p>Wait for the host to start the quiz…</p>
        <div class="pulse-ring"></div>
      </div>
    </div>

    <!-- ACTIVE QUESTION -->
    <div *ngIf="view === 'question'" class="play-page question">
      <div class="play-container">
        <div class="question-progress">
          <span>{{ (currentQuestion?.index ?? 0) + 1 }} / {{ currentQuestion?.totalQuestions }}</span>
          <app-countdown-timer
            *ngIf="currentQuestion?.timeLimitSec"
            [seconds]="currentQuestion!.timeLimitSec!"
            (finished)="onTimerEnd()"
          />
        </div>

        <div class="question-card">
          <img
            *ngIf="currentQuestion?.question?.image_url"
            [src]="currentQuestion!.question.image_url"
            class="question-img" alt=""
          />
          <h2>{{ currentQuestion?.question?.body }}</h2>
          <p class="multi-hint" *ngIf="currentQuestion?.question?.type === 'multi'">
            Select all correct answers
          </p>
        </div>

        <div class="options-grid">
          <button
            *ngFor="let opt of currentQuestion?.question?.options; let i = index"
            class="option-btn"
            [class]="'option-color-' + i"
            [class.selected]="selectedIds.has(opt.id)"
            [disabled]="answered"
            (click)="selectOption(opt.id)"
          >
            {{ opt.body }}
          </button>
        </div>

        <p-button
          *ngIf="currentQuestion?.question?.type === 'multi' && !answered"
          label="Submit Answer"
          icon="pi pi-check"
          styleClass="w-full mt-2"
          [disabled]="selectedIds.size === 0"
          (onClick)="submitAnswer()"
        />
      </div>
    </div>

    <!-- ANSWER FEEDBACK -->
    <div *ngIf="view === 'answer-feedback'" class="play-page feedback"
      [class.correct]="lastAnswerCorrect"
      [class.incorrect]="!lastAnswerCorrect"
    >
      <div class="feedback-inner">
        <span class="feedback-icon">{{ lastAnswerCorrect ? '✅' : '❌' }}</span>
        <h2>{{ lastAnswerCorrect ? 'Correct!' : 'Wrong!' }}</h2>
        <p *ngIf="lastAnswerCorrect">+{{ lastPoints }} points</p>
        <p *ngIf="!lastAnswerCorrect">Better luck next time</p>
        <div class="feedback-hint">Waiting for next question…</div>
      </div>
    </div>

    <!-- INTERMISSION (between questions, no answer submitted) -->
    <div *ngIf="view === 'intermission'" class="play-page waiting">
      <div class="waiting-inner">
        <h2>⏱ Time's up!</h2>
        <p>Waiting for the next question…</p>
      </div>
    </div>

    <!-- ENDED -->
    <div *ngIf="view === 'ended'" class="play-page ended">
      <div class="play-container">
        <div class="final-score">
          <h1>🏆 Quiz Over!</h1>
          <div class="score-display">
            <span class="score-value">{{ myScore }}</span>
            <span class="score-label">points</span>
          </div>
          <div class="rank-display" *ngIf="myRank">
            Rank <strong>#{{ myRank }}</strong> out of {{ leaderboard.length }}
          </div>
        </div>
        <app-leaderboard [entries]="leaderboard" [highlightName]="myDisplayName" />
        <p-button
          label="Play Again"
          icon="pi pi-refresh"
          styleClass="mt-4"
          (onClick)="playAgain()"
        />
      </div>
    </div>
  `,
  styles: [`
    .play-page {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      padding: 1.5rem;
    }
    .play-page.waiting  { background: #0f172a; color: white; }
    .play-page.question { background: #0f172a; color: white; }
    .play-page.feedback { color: white; }
    .play-page.feedback.correct  { background: #15803d; }
    .play-page.feedback.incorrect { background: #b91c1c; }
    .play-page.ended    { background: #0f172a; color: white; }

    .waiting-inner, .feedback-inner { text-align: center; }
    .play-logo { font-size: 3rem; }
    .waiting-inner h2 { font-size: 2rem; margin: 1rem 0 0.5rem; }
    .waiting-inner p { color: #94a3b8; }
    .pulse-ring {
      width: 60px; height: 60px; border-radius: 50%;
      border: 4px solid #38bdf8; margin: 2rem auto 0;
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%,100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.5; }
    }
    .feedback-icon { font-size: 4rem; display: block; }
    .feedback-inner h2 { font-size: 2.5rem; margin: 0.5rem 0; }
    .feedback-hint { color: rgba(255,255,255,0.6); margin-top: 1.5rem; }

    .play-container { width: 100%; max-width: 600px; }
    .question-progress {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.5rem; color: #94a3b8;
    }
    .question-card {
      background: rgba(255,255,255,0.05); border-radius: 16px;
      padding: 1.5rem; margin-bottom: 1.5rem; text-align: center;
    }
    .question-img { max-height: 180px; border-radius: 10px; margin-bottom: 1rem; }
    .question-card h2 { font-size: 1.5rem; margin: 0; }
    .multi-hint { color: #94a3b8; margin: 0.5rem 0 0; font-size: 0.875rem; }
    .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .option-btn {
      padding: 1.25rem; border-radius: 12px; border: none;
      font-size: 1rem; font-weight: 600; color: white;
      cursor: pointer; transition: transform 0.1s, opacity 0.1s;
    }
    .option-btn:hover:not(:disabled) { transform: scale(1.02); }
    .option-btn:disabled { opacity: 0.6; cursor: default; }
    .option-btn.selected { outline: 4px solid white; }
    .option-color-0 { background: #ef4444; }
    .option-color-1 { background: #3b82f6; }
    .option-color-2 { background: #22c55e; }
    .option-color-3 { background: #f59e0b; }

    .final-score { text-align: center; margin-bottom: 2rem; }
    .final-score h1 { font-size: 2rem; margin-bottom: 1rem; }
    .score-display { display: flex; align-items: baseline; justify-content: center; gap: 0.5rem; }
    .score-value { font-size: 4rem; font-weight: 900; color: #38bdf8; }
    .score-label { font-size: 1.25rem; color: #94a3b8; }
    .rank-display { color: #94a3b8; margin-top: 0.5rem; }
  `],
})
export class PlayComponent implements OnInit, OnDestroy {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private socket = inject(SocketService);
  private auth   = inject(AuthService);
  private toast  = inject(MessageService);

  private subs = new Subscription();

  view:          PlayView = 'waiting';
  sessionId!:    string;
  myDisplayName  = '';
  myScore        = 0;
  myRank: number | null = null;

  currentQuestion: QuestionEvent | null = null;
  selectedIds      = new Set<string>();
  answered         = false;
  lastAnswerCorrect = false;
  lastPoints       = 0;
  leaderboard: any[] = [];

  ngOnInit(): void {
    this.sessionId    = this.route.snapshot.paramMap.get('sessionId')!;
    this.myDisplayName = this.auth.isLoggedIn()
      ? this.auth.currentUser()!.display_name
      : sessionStorage.getItem('pending_join_name') || 'You';

    this.socket.connect();

    this.subs.add(
      this.socket.onQuestion().subscribe((e) => {
        this.currentQuestion = e;
        this.selectedIds     = new Set();
        this.answered        = false;
        this.view            = 'question';
      })
    );

    this.subs.add(
      this.socket.onAnswerReceived().subscribe((e) => {
        this.lastAnswerCorrect = e.isCorrect;
        this.lastPoints        = e.pointsAwarded;
        this.myScore          += e.pointsAwarded;
        this.view              = 'answer-feedback';
      })
    );

    this.subs.add(
      this.socket.onQuestionEnded().subscribe(() => {
        if (this.view !== 'answer-feedback') {
          this.view = 'intermission';
        }
      })
    );

    this.subs.add(
      this.socket.onSessionEnded().subscribe((e) => {
        this.leaderboard = e.leaderboard;
        const me         = e.leaderboard.find((l) => l.display_name === this.myDisplayName);
        if (me) {
          this.myScore = me.score;
          this.myRank  = me.rank;
        }

        // Save anonymous session to localStorage
        if (!this.auth.isLoggedIn()) {
          saveAnonymousSession({
            sessionId:   this.sessionId,
            displayName: this.myDisplayName,
            joinedAt:    new Date().toISOString(),
          });
        }

        this.view = 'ended';
      })
    );

    this.subs.add(
      this.socket.onError().subscribe((e) => {
        this.toast.add({ severity: 'error', summary: 'Error', detail: e.message });
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.socket.disconnect();
  }

  selectOption(id: string): void {
    if (this.answered) return;

    if (this.currentQuestion?.question.type === 'single') {
      this.selectedIds = new Set([id]);
      this.submitAnswer();
    } else {
      if (this.selectedIds.has(id)) {
        this.selectedIds.delete(id);
      } else {
        this.selectedIds.add(id);
      }
      this.selectedIds = new Set(this.selectedIds); // trigger change detection
    }
  }

  submitAnswer(): void {
    if (this.answered || !this.currentQuestion) return;
    this.answered = true;
    this.socket.submitAnswer(
      this.sessionId,
      this.currentQuestion.question.id,
      Array.from(this.selectedIds)
    );
  }

  onTimerEnd(): void {
    if (!this.answered) {
      this.answered = true;
      this.view     = 'intermission';
    }
  }

  playAgain(): void {
    this.router.navigate(['/join']);
  }
}