import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Quiz {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'active' | 'ended' | 'archived';
  join_code: string;
  default_time_limit_sec: number | null;
  question_count: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionOption {
  id: string;
  body: string;
  is_correct: boolean;
  position: number;
}

export interface Question {
  id: string;
  quiz_id: string;
  type: 'single' | 'multi';
  body: string | null;
  image_url: string | null;
  position: number;
  time_limit_sec: number | null;
  points: number;
  options: QuestionOption[];
}

export interface Session {
  id: string;
  quiz_id: string;
  host_id: string;
  status: 'waiting' | 'question' | 'results' | 'finished';
  current_question_index: number | null;
  question_started_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  quiz_title?: string;
  join_code?: string;
}

@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly api = `${environment.apiUrl}/quizzes`;

  constructor(private http: HttpClient) {}

  // Quizzes

  listQuizzes(): Observable<{ quizzes: Quiz[] }> {
    return this.http.get<{ quizzes: Quiz[] }>(this.api);
  }

  getQuiz(id: string): Observable<{ quiz: Quiz & { questions: Question[] } }> {
    return this.http.get<{ quiz: Quiz & { questions: Question[] } }>(`${this.api}/${id}`);
  }

  createQuiz(payload: Partial<Quiz>): Observable<{ quiz: Quiz }> {
    return this.http.post<{ quiz: Quiz }>(this.api, payload);
  }

  updateQuiz(id: string, payload: Partial<Quiz>): Observable<{ quiz: Quiz }> {
    return this.http.patch<{ quiz: Quiz }>(`${this.api}/${id}`, payload);
  }

  deleteQuiz(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/${id}`);
  }

  // Sessions

  startSession(quizId: string): Observable<{ session: Session }> {
    return this.http.post<{ session: Session }>(`${this.api}/${quizId}/sessions`, {});
  }

  getSession(quizId: string, sessionId: string): Observable<{ session: Session }> {
    return this.http.get<{ session: Session }>(`${this.api}/${quizId}/sessions/${sessionId}`);
  }

  getLeaderboard(quizId: string, sessionId: string): Observable<{ leaderboard: any[] }> {
    return this.http.get<{ leaderboard: any[] }>(`${this.api}/${quizId}/sessions/${sessionId}/leaderboard`);
  }

  // Questions

  createQuestion(quizId: string, formData: FormData): Observable<{ question: Question }> {
    return this.http.post<{ question: Question }>(`${this.api}/${quizId}/questions`, formData);
  }

  updateQuestion(quizId: string, questionId: string, formData: FormData): Observable<{ question: Question }> {
    return this.http.patch<{ question: Question }>(`${this.api}/${quizId}/questions/${questionId}`, formData);
  }

  deleteQuestion(quizId: string, questionId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/${quizId}/questions/${questionId}`);
  }

  reorderQuestions(quizId: string, orderedIds: string[]): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.api}/${quizId}/questions/reorder`, { orderedIds });
  }
}