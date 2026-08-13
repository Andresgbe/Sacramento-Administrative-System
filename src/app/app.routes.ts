import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page/dashboard-page').then(
            (m) => m.DashboardPage,
          ),
        data: { title: 'Dashboard'},
      },
      {
        path: 'locales',
        loadComponent: () =>
          import('./features/locales/locales-page/locales-page').then((m) => m.LocalesPage),
        data: { title: 'Locales' },
      },
      {
        path: 'pagos',
        loadComponent: () =>
          import('./shared/components/coming-soon/coming-soon').then((m) => m.ComingSoon),
        data: { title: 'Pagos de alquiler', subtitle: 'Registro y control de pagos' },
      },
      {
        path: 'egresos',
        loadComponent: () =>
          import('./shared/components/coming-soon/coming-soon').then((m) => m.ComingSoon),
        data: { title: 'Egresos', subtitle: 'Gastos y salidas de dinero' },
      },
      {
        path: 'caja-chica',
        loadComponent: () =>
          import('./shared/components/coming-soon/coming-soon').then((m) => m.ComingSoon),
        data: { title: 'Caja chica', subtitle: 'Control de caja chica' },
      },
    ],
  },
];
