import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  // Public
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'join',
    loadComponent: () =>
      import('./features/quiz-participant/join/join.component').then((m) => m.JoinComponent),
  },
  {
    path: 'play/:sessionId',
    loadComponent: () =>
      import('./features/quiz-participant/play/play.component').then((m) => m.PlayComponent),
  },

  // Protected
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'quiz/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/quiz-builder/quiz-builder.component').then((m) => m.QuizBuilderComponent),
  },
  {
    path: 'quiz/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/quiz-builder/quiz-builder.component').then((m) => m.QuizBuilderComponent),
  },
  {
    path: 'quiz/:id/host/:sessionId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/quiz-host/quiz-host.component').then((m) => m.QuizHostComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'profile/sessions/:sessionId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/session-detail/session-detail.component').then(
        (m) => m.SessionDetailComponent
      ),
  },

  { path: '**', redirectTo: '/dashboard' },
];