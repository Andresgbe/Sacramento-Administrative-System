import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const rol = await authService.waitForRole();

  return rol === 'admin' ? true : router.parseUrl('/dashboard');
};

/** Only the one admin flagged `usuarios.es_principal`. RLS enforces the same
 *  rule on the data; this just keeps everyone else off an empty page. */
export const principalGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.waitForRole();

  return authService.isPrincipal() ? true : router.parseUrl('/dashboard');
};
