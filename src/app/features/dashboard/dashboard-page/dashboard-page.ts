import { Component } from '@angular/core';
import { BarChart, BarDatum } from '../../../shared/components/bar-chart/bar-chart';
import { DonutChart, DonutSegment } from '../../../shared/components/donut-chart/donut-chart';

interface DashboardStat {
  label: string;
  value: string;
  tone: 'accent' | 'default' | 'danger';
}

interface RecentPayment {
  date: string;
  local: string;
  amount: string;
}

interface UpcomingDue {
  local: string;
  dueDate: string;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [DonutChart, BarChart],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  // Placeholder data until dashboard queries are wired up to Supabase
  protected readonly stats: DashboardStat[] = [
    { label: 'Caja chica disponible', value: '$ 1,208.50', tone: 'accent' },
    { label: 'Locales activos', value: '39', tone: 'default' },
    { label: 'Locales vencidos', value: '3', tone: 'danger' },
    { label: 'Ingresos del mes', value: '$ 4,120.00', tone: 'default' },
  ];

  protected readonly recentPayments: RecentPayment[] = [
    { date: '03/08/2026', local: 'Local 31 — Óptica Visión', amount: '$ 425.00' },
    { date: '02/08/2026', local: 'Local 05 — Boutique Luna', amount: '$ 390.00' },
    { date: '01/08/2026', local: 'Local 08 — Ferretería El Tornillo', amount: '$ 480.00' },
  ];

  protected readonly upcomingDues: UpcomingDue[] = [
    { local: 'Local 22 — Farmacia San José', dueDate: '10/08/2026' },
    { local: 'Local 14 — Panadería Central', dueDate: '05/08/2026' },
    { local: 'Local 17 — Café Andino', dueDate: '05/08/2026' },
  ];

  protected readonly localesPorEstado: DonutSegment[] = [
    { label: 'Activo', value: 39, color: 'var(--color-success)' },
    { label: 'Vencido', value: 3, color: 'var(--color-danger)' },
    { label: 'Inactivo', value: 5, color: 'var(--color-neutral)' },
  ];

  protected readonly ingresosMensuales: BarDatum[] = [
    { label: 'Mar', value: 3200 },
    { label: 'Abr', value: 3450 },
    { label: 'May', value: 3100 },
    { label: 'Jun', value: 3800 },
    { label: 'Jul', value: 3950 },
    { label: 'Ago', value: 4120 },
  ];
}
