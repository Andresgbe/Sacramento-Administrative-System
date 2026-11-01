import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ModulosService } from '../services/modulos.service';

/**
 * Blocks a module the admin principal switched off. Hiding the menu entry is
 * not enough on its own: a bookmarked URL would still open the page.
 * The module id is the route's first path segment.
 */
export const moduloGuard: CanActivateFn = async (route) => {
  const modulosService = inject(ModulosService);
  const router = inject(Router);

  await modulosService.load();

  const modulo = route.url[0]?.path ?? '';
  return modulosService.habilitado(modulo) ? true : router.parseUrl('/dashboard');
};
