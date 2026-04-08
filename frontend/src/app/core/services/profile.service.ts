import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface OrganizerSession {
  session_id: string;
  quiz_id: string;
  quiz_title: string;
  join_code: string;
  started_at: string;
  ended_at: string;
  participant_count: number;
  top_score: number;
}

export interface ParticipantSession {
  session_id: string;
  quiz_title: string;
  join_code: string;
  started_at: string;
  ended_at: string;
  display_name: string;
  score: number;
  rank: number;
  questions_answered: number;
  correct_answers: number;
  source: 'db' | 'local'; // merged from DB or localStorage
}

export interface SessionResults {
  session: any;
  leaderboard: LeaderboardEntry[];
  questions: ResultQuestion[];
  answers: AnswerRecord[];
}

export interface LeaderboardEntry {
  participant_id: string;
  display_name: string;
  score: number;
  rank: number;
  questions_answered: number;
  avg_response_ms: number;
}

export interface ResultQuestion {
  id: string;
  body: string | null;
  image_url: string | null;
  position: number;
  type: string;
  points: number;
  correct_option_ids: string[];
  options: any[];
  correct_count: number;
  total_answers: number;
  correct_pct: number;
  avg_response_ms: number;
}

export interface AnswerRecord {
  question_id: string;
  participant_id: string;
  display_name: string;
  chosen_option_ids: string[];
  is_correct: boolean;
  points_awarded: number;
  response_time_ms: number;
}

// localStorage utils

const LS_KEY = 'quiz_anonymous_sessions';

export interface LocalSession {
  sessionId: string;
  displayName: string;
  joinedAt: string;
}

export function saveAnonymousSession(entry: LocalSession): void {
  const existing = loadAnonymousSessions();
  const updated  = [entry, ...existing.filter((s) => s.sessionId !== entry.sessionId)];
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
}

export function loadAnonymousSessions(): LocalSession[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = `${environment.apiUrl}/profile`;

  constructor(private http: HttpClient) {}

  // Organizer

  getOrganizerSessions(): Observable<{ sessions: OrganizerSession[] }> {
    return this.http.get<{ sessions: OrganizerSession[] }>(`${this.api}/me/sessions`);
  }

  // Participant

  getParticipantSessions(): Observable<ParticipantSession[]> {
    const dbSessions$ = this.http
      .get<{ sessions: any[] }>(`${this.api}/me/participations`)
      .pipe(
        map((res) => res.sessions.map((s) => ({ ...s, source: 'db' as const }))),
        catchError(() => of([]))
      );

    const localEntries = loadAnonymousSessions();

    if (!localEntries.length) {
      return dbSessions$;
    }

    // Fetch results for each anonymous session to get score + rank
    const localFetches$ = localEntries.map((entry) =>
      this.getSessionResults(entry.sessionId).pipe(
        map((results): ParticipantSession => {
          const lb = results.leaderboard.find(
            (l) => l.display_name === entry.displayName
          );
          return {
            session_id:         entry.sessionId,
            quiz_title:         results.session.quiz_title,
            join_code:          results.session.join_code,
            started_at:         results.session.started_at,
            ended_at:           results.session.ended_at,
            display_name:       entry.displayName,
            score:              lb?.score ?? 0,
            rank:               lb?.rank  ?? 0,
            questions_answered: lb?.questions_answered ?? 0,
            correct_answers:    0,
            source:             'local',
          };
        }),
        catchError(() => of(null))
      )
    );

    return forkJoin([dbSessions$, forkJoin(localFetches$)]).pipe(
      map(([dbList, localList]) => {
        const filtered = (localList as any[]).filter(Boolean) as ParticipantSession[];
        // Deduplicate: prefer DB record if same sessionId exists in both
        const dbIds = new Set(dbList.map((s: any) => s.session_id));
        const uniqueLocal = filtered.filter((s) => !dbIds.has(s.session_id));
        return [...dbList, ...uniqueLocal].sort(
          (a, b) => new Date(b.ended_at).getTime() - new Date(a.ended_at).getTime()
        );
      })
    );
  }

  // Session results

  getSessionResults(sessionId: string): Observable<SessionResults> {
    return this.http.get<SessionResults>(`${this.api}/sessions/${sessionId}/results`);
  }

  // Export

  exportCsv(results: SessionResults): void {
    const rows: string[][] = [
      ['Rank', 'Participant', 'Score', 'Questions Answered', 'Avg Response (ms)'],
      ...results.leaderboard.map((l) => [
        String(l.rank),
        l.display_name,
        String(l.score),
        String(l.questions_answered),
        String(l.avg_response_ms ?? ''),
      ]),
    ];

    const csv     = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url     = URL.createObjectURL(blob);
    const link    = document.createElement('a');
    link.href     = url;
    link.download = `quiz-results-${results.session.join_code}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportPdf(results: SessionResults): void {
    // Dynamic import so jspdf is only loaded when needed
    import('jspdf').then(({ jsPDF }) => {
      import('jspdf-autotable').then(() => {
        const doc  = new jsPDF();
        const quiz = results.session.quiz_title;
        const date = new Date(results.session.ended_at).toLocaleDateString();

        doc.setFontSize(18);
        doc.text(`${quiz} — Results`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Date: ${date}  |  Participants: ${results.leaderboard.length}`, 14, 30);

        (doc as any).autoTable({
          startY: 38,
          head: [['Rank', 'Participant', 'Score', 'Questions Answered']],
          body: results.leaderboard.map((l) => [
            l.rank,
            l.display_name,
            l.score,
            l.questions_answered,
          ]),
          theme: 'striped',
        });

        doc.save(`quiz-results-${results.session.join_code}.pdf`);
      });
    });
  }
}