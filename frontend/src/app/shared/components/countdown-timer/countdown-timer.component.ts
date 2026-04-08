import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressBarModule } from 'primeng/progressbar';

@Component({
  selector: 'app-countdown-timer',
  standalone: true,
  imports: [CommonModule, ProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="countdown-wrap">
      <span class="countdown-value" [class.urgent]="remaining <= 5">
        {{ remaining }}
      </span>
      <p-progressBar
        [value]="progress"
        [showValue]="false"
        [styleClass]="'countdown-bar' + (remaining <= 5 ? ' urgent' : '')"
      />
    </div>
  `,
  styles: [`
    .countdown-wrap {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 140px;
    }
    .countdown-value {
      font-size: 1.5rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: #38bdf8;
      min-width: 2ch;
      text-align: right;
      transition: color 0.3s;
    }
    .countdown-value.urgent {
      color: #ef4444;
      animation: tick 1s step-end infinite;
    }
    @keyframes tick {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }
    :host ::ng-deep .countdown-bar .p-progressbar-value {
      background: #38bdf8;
      transition: width 0.9s linear, background 0.3s;
    }
    :host ::ng-deep .countdown-bar.urgent .p-progressbar-value {
      background: #ef4444;
    }
    :host ::ng-deep .countdown-bar .p-progressbar {
      background: rgba(255,255,255,0.1);
      height: 6px;
      border-radius: 99px;
    }
  `],
})
export class CountdownTimerComponent implements OnInit, OnDestroy {
  @Input() seconds = 30;
  @Output() finished = new EventEmitter<void>();

  remaining = 0;
  progress  = 100;

  private cdr      = inject(ChangeDetectorRef);
  private interval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.remaining = this.seconds;
    this.progress  = 100;

    this.interval = setInterval(() => {
      this.remaining--;
      this.progress = Math.max(0, Math.round((this.remaining / this.seconds) * 100));
      this.cdr.markForCheck();

      if (this.remaining <= 0) {
        this.clearTimer();
        this.finished.emit();
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}