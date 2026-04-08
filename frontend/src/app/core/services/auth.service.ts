import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: 'organizer' | 'participant';
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

const TOKEN_KEY = 'quiz_token';
const USER_KEY  = 'quiz_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = `${environment.apiUrl}/auth`;

  // Angular signals for reactive auth state
  private _currentUser = signal<User | null>(this.loadUser());
  private _token       = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly currentUser  = this._currentUser.asReadonly();
  readonly token        = this._token.asReadonly();
  readonly isLoggedIn   = computed(() => !!this._currentUser());
  readonly isOrganizer  = computed(() => this._currentUser()?.role === 'organizer');

  constructor(private http: HttpClient, private router: Router) {}

  register(payload: { email: string; displayName: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/register`, payload).pipe(
      tap((res) => this.persist(res))
    );
  }

  login(payload: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/login`, payload).pipe(
      tap((res) => this.persist(res))
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._currentUser.set(null);
    this._token.set(null);
    this.router.navigate(['/login']);
  }

  refreshMe(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(`${this.api}/me`).pipe(
      tap((res) => {
        this._currentUser.set(res.user);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      })
    );
  }

  private persist(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this._currentUser.set(res.user);
    this._token.set(res.token);
  }

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}