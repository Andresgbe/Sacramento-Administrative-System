import { Component, OnInit, computed, inject } from '@angular/core';
import { PagosService } from '../../pagos/pagos.service';
import { LocalesService } from '../../locales/locales.service';
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
export class DashboardPage implements OnInit {
  private readonly localesService = inject(LocalesService);
  private readonly pagosService = inject(PagosService);

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

  // Live: computed from LocalesService + PagosService.
  protected readonly localesPorPago = computed<DonutSegment[]>(() => {
    const locales = this.localesService.all();

    let alDia = 0;
    let faltanPorPagar = 0;
    let masDeDosMeses = 0;

    for (const local of locales) {
      const meses = this.pagosService.monthsSinceLastPayment(local.id);

      if (meses === 0) {
        alDia++;
      } else if (meses === null || meses > 2) {
        masDeDosMeses++;
      } else {
        faltanPorPagar++;
      }
    }

    return [
      { label: 'Al día', value: alDia, color: 'var(--color-success)' },
      { label: 'Faltan por pagar', value: faltanPorPagar, color: 'var(--color-accent)' },
      { label: 'Más de 2 meses sin pagar', value: masDeDosMeses, color: 'var(--color-danger)' },
    ];
  });

  protected readonly ingresosMensuales: BarDatum[] = [
    { label: 'Mar', value: 3200 },
    { label: 'Abr', value: 3450 },
    { label: 'May', value: 3100 },
    { label: 'Jun', value: 3800 },
    { label: 'Jul', value: 3950 },
    { label: 'Ago', value: 4120 },
  ];

  ngOnInit(): void {
    this.localesService.load();
    this.pagosService.load();
  }
}
