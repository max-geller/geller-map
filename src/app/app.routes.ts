import { Routes } from '@angular/router';
import { authGuard, publicGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
    canActivate: [publicGuard],
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'map/:id',
    loadComponent: () =>
      import('./features/editor/editor.component').then((m) => m.EditorComponent),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
