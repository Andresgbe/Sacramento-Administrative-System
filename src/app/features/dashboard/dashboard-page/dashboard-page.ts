import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoriaEgreso } from '../../../core/models/egreso.model';
import { PagosService } from '../../pagos/pagos.service';
import { LocalesService } from '../../locales/locales.service';
import { CajaChicaService } from '../../caja-chica/caja-chica.service';
import { EgresosService } from '../../egresos/egresos.service';
import { BarChart, BarDatum } from '../../../shared/components/bar-chart/bar-chart';
import { PieChart, PieSegment } from '../../../shared/components/pie-chart/pie-chart';

interface DashboardStat {
  label: string;
  value: string;
  tone: 'accent' | 'default' | 'danger';
}

@Component({
  selector: 'app-dashboard-page',
  imports: [PieChart, BarChart, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage implements OnInit {
  private readonly localesService = inject(LocalesService);
  private readonly pagosService = inject(PagosService);
  private readonly cajaChicaService = inject(CajaChicaService);
  private readonly egresosService = inject(EgresosService);

  protected readonly categoriaEgresoLabel: Record<CategoriaEgreso, string> = {
    administrativo: 'Administrativo',
    operativo: 'Operativo',
  };

  protected readonly stats = computed<DashboardStat[]>(() => {
    const locales = this.localesService.all();
    const localesActivos = locales.filter((local) => local.estado === 'activo').length;

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const ingresosDelMes = this.pagosService
      .all()
      .filter((pago) => pago.fecha.startsWith(yearMonth))
      .reduce((sum, pago) => sum + pago.monto, 0);
    const egresosDelMes = this.egresosService
      .all()
      .filter((egreso) => egreso.fecha.startsWith(yearMonth))
      .reduce((sum, egreso) => sum + egreso.monto, 0);

    return [
      {
        label: 'Caja chica disponible',
        value: this.formatUsd(this.cajaChicaService.balance()),
        tone: 'accent',
      },
      { label: 'Locales activos', value: `${localesActivos}`, tone: 'default' },
      { label: 'Egresos del mes', value: this.formatUsd(egresosDelMes), tone: 'danger' },
      { label: 'Ingresos del mes', value: this.formatUsd(ingresosDelMes), tone: 'default' },
    ];
  });

  // Live: most recent payments, already sorted newest-first by PagosService.
  protected readonly recentPayments = computed(() => this.pagosService.all().slice(0, 3));

  // Live: most recent expenses, already sorted newest-first by EgresosService.
  protected readonly recentEgresos = computed(() => this.egresosService.all().slice(0, 3));

  // Live: computed from LocalesService + PagosService.
  protected readonly localesPorPago = computed<PieSegment[]>(() => {
    const locales = this.localesService.all();

    let alDia = 0;
    const morosos: string[] = [];

    for (const local of locales) {
      if (this.pagosService.hasPaidThisMonth(local.id)) {
        alDia++;
      } else {
        morosos.push(local.nombreComercial);
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
    this.egresosService.load();
  }

  private formatUsd(value: number): string {
    return `$ ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
