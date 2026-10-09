import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page/login-page').then((m) => m.LoginPage),
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
          import('./features/dashboard/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
        data: { title: 'Dashboard' },
      },
      {
        path: 'locales',
        loadComponent: () =>
          import('./features/locales/locales-page/locales-page').then((m) => m.LocalesPage),
        data: { title: 'Locales' },
      },
      {
        path: 'locales/:id',
        loadComponent: () =>
          import('./features/locales/local-detail-page/local-detail-page').then(
            (m) => m.LocalDetailPage,
          ),
        data: { title: 'Local' },
      },
      {
        path: 'pagos',
        loadComponent: () =>
          import('./features/pagos/pagos-page/pagos-page').then((m) => m.PagosPage),
        data: { title: 'Reporte de pagos'},
      },
      {
        path: 'calculadora',
        loadComponent: () =>
          import('./features/calculadora/calculadora-page/calculadora-page').then(
            (m) => m.CalculadoraPage,
          ),
        data: { title: 'Calculadora', subtitle: 'Conversión USD ↔ Bs con tasas del día' },
      },
      {
        path: 'egresos',
        loadComponent: () =>
          import('./features/egresos/egresos-page/egresos-page').then((m) => m.EgresosPage),
        data: { title: 'Reporte de egresos', subtitle: 'Gastos administrativos, operativos y de remodelación' },
      },
      {
        path: 'balance',
        loadComponent: () =>
          import('./features/balance/balance-page/balance-page').then((m) => m.BalancePage),
        data: { title: 'Balance'},
      },
      {
        path: 'reportes',
        loadComponent: () =>
          import('./features/reportes/reportes-page/reportes-page').then((m) => m.ReportesPage),
        data: { title: 'Reportes'},
      },
      {
        path: 'servicios-basicos',
        loadComponent: () =>
          import('./features/servicios-basicos/servicios-basicos-page/servicios-basicos-page').then(
            (m) => m.ServiciosBasicosPage,
          ),
        data: {
          title: 'Servicios',
        },
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/usuarios/usuarios-page/usuarios-page').then((m) => m.UsuariosPage),
        data: { title: 'Usuarios', subtitle: 'Gestión de accesos del equipo' },
      },
    ],
  },
];
