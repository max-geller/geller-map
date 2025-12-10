import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth to be initialized
  while (!authService.authInitialized()) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const publicGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth to be initialized
  while (!authService.authInitialized()) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (!authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/']);
};
