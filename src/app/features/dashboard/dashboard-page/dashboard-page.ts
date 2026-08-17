import { Component, OnInit, computed, inject } from '@angular/core';
import { PagosService } from '../../pagos/pagos.service';
import { LocalesService } from '../../locales/locales.service';
import { CajaChicaService } from '../../caja-chica/caja-chica.service';
import { BarChart, BarDatum } from '../../../shared/components/bar-chart/bar-chart';
import { PieChart, PieSegment } from '../../../shared/components/pie-chart/pie-chart';

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
  imports: [PieChart, BarChart],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage implements OnInit {
  private readonly localesService = inject(LocalesService);
  private readonly pagosService = inject(PagosService);
  private readonly cajaChicaService = inject(CajaChicaService);

  // Live: caja chica disponible comes from CajaChicaService; the rest are
  // still placeholders until those queries get wired up to Supabase.
  protected readonly stats = computed<DashboardStat[]>(() => [
    {
      label: 'Caja chica disponible',
      value: `$ ${this.cajaChicaService.balance().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      tone: 'accent',
    },
    { label: 'Locales activos', value: '39', tone: 'default' },
    { label: 'Locales vencidos', value: '3', tone: 'danger' },
    { label: 'Ingresos del mes', value: '$ 4,120.00', tone: 'default' },
  ]);

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
  protected readonly localesPorPago = computed<PieSegment[]>(() => {
    const locales = this.localesService.all();

    let alDia = 0;
    const morosos: string[] = [];

    for (const local of locales) {
      if (this.pagosService.hasPaidThisMonth(local.id)) {
        alDia++;
      } else {
        morosos.push(`${local.numeroLocal} — ${local.nombreComercial}`);
      }
    }

    return [
      { label: 'Al día', value: alDia, color: 'var(--color-success)' },
      { label: 'Morosos', value: morosos.length, color: 'var(--color-danger)', items: morosos },
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
    this.cajaChicaService.load();
  }
}
