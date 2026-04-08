import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, TableModule, TagModule],
  template: `
    <p-table [value]="entries" styleClass="p-datatable-sm leaderboard-table">
      <ng-template pTemplate="header">
        <tr>
          <th style="width:60px">Rank</th>
          <th>Player</th>
          <th style="width:100px">Score</th>
          <th style="width:130px">Questions</th>
          <th style="width:120px">Avg Time</th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-e>
        <tr [class.highlighted-row]="highlightName && e.display_name === highlightName">
          <td>
            <span class="rank-badge" [class]="'rank-' + e.rank">
              {{ e.rank <= 3 ? medals[e.rank - 1] : '#' + e.rank }}
            </span>
          </td>
          <td>
            <strong>{{ e.display_name }}</strong>
            <p-tag *ngIf="highlightName && e.display_name === highlightName"
              value="You" severity="info" styleClass="ml-2" />
          </td>
          <td><strong>{{ e.score }}</strong></td>
          <td>{{ e.questions_answered }}</td>
          <td>{{ e.avg_response_ms ? (e.avg_response_ms | number:'1.0-0') + 'ms' : '—' }}</td>
        </tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    .rank-badge {
      font-weight: 700; font-size: 1rem;
      display: inline-block; min-width: 36px; text-align: center;
    }
    .rank-1 { color: #f59e0b; font-size: 1.25rem; }
    .rank-2 { color: #94a3b8; font-size: 1.1rem;  }
    .rank-3 { color: #b45309; }
    .highlighted-row { background: rgba(56,189,248,0.08) !important; }
  `],
})
export class LeaderboardComponent {
  @Input() entries: any[]       = [];
  @Input() highlightName: string = '';

  medals = ['🥇', '🥈', '🥉'];
}