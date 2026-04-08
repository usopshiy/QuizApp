import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

// Event payload types

export interface ParticipantJoinedEvent {
  participant: { id: string; display_name: string; score: number };
  sessionId: string;
}

export interface QuestionEvent {
  index: number;
  totalQuestions: number;
  timeLimitSec: number | null;
  question: {
    id: string;
    body: string | null;
    image_url: string | null;
    type: 'single' | 'multi';
    points: number;
    options: { id: string; body: string; position: number }[];
  };
}

export interface QuestionEndedEvent {
  questionId: string;
  correctOptionIds: string[];
  stats: {
    total_answers: number;
    correct_count: number;
    correct_pct: number;
    avg_response_ms: number;
  } | null;
}

export interface SessionEndedEvent {
  leaderboard: {
    participant_id: string;
    display_name: string;
    score: number;
    rank: number;
    questions_answered: number;
    avg_response_ms: number;
  }[];
}

export interface AnswerReceivedEvent {
  isCorrect: boolean;
  pointsAwarded: number;
}

export interface SocketError {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket!: Socket;

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () =>
      console.log('Socket connected:', this.socket.id)
    );
    this.socket.on('disconnect', () =>
      console.log('Socket disconnected')
    );
  }

  disconnect(): void {
    this.socket?.disconnect();
  }

  // Emit utils

  hostJoin(sessionId: string, token: string): void {
    this.socket.emit('host:join', { sessionId, token });
  }

  participantJoin(joinCode: string, displayName: string, token?: string): void {
    this.socket.emit('participant:join', { joinCode, displayName, token });
  }

  hostNext(sessionId: string): void {
    this.socket.emit('host:next', { sessionId });
  }

  hostEnd(sessionId: string): void {
    this.socket.emit('host:end', { sessionId });
  }

  submitAnswer(sessionId: string, questionId: string, optionIds: string[]): void {
    this.socket.emit('participant:answer', { sessionId, questionId, optionIds });
  }

  // Observable listeners
  onAnswerSubmitted(): Observable<{ participantId: string }> {
    return this.fromEvent('answer:submitted');
  }

  onParticipantJoined(): Observable<ParticipantJoinedEvent> {
    return this.fromEvent('session:participantJoined');
  }

  onRejoined(): Observable<{ participant: any }> {
    return this.fromEvent('session:rejoined');
  }

  onQuestion(): Observable<QuestionEvent> {
    return this.fromEvent('session:question');
  }

  onQuestionEnded(): Observable<QuestionEndedEvent> {
    return this.fromEvent('session:questionEnded');
  }

  onSessionEnded(): Observable<SessionEndedEvent> {
    return this.fromEvent('session:ended');
  }

  onAnswerReceived(): Observable<AnswerReceivedEvent> {
    return this.fromEvent('answer:received');
  }

  onError(): Observable<SocketError> {
    return this.fromEvent('error');
  }

  // Generic typed event helper

  private fromEvent<T>(event: string): Observable<T> {
    return new Observable<T>((observer) => {
      this.socket.on(event, (data: T) => observer.next(data));
      return () => this.socket.off(event);
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}