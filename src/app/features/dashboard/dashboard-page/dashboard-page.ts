import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoriaEgreso } from '../../../core/models/egreso.model';
import { PagosService } from '../../pagos/pagos.service';
import { EmpresasService } from '../../locales/empresas.service';
import { LocalesService } from '../../locales/locales.service';
import { EgresosService } from '../../egresos/egresos.service';
import { BarChart, BarDatum } from '../../../shared/components/bar-chart/bar-chart';
import { PieChart, PieSegment } from '../../../shared/components/pie-chart/pie-chart';

interface DashboardStat {
  label: string;
  value: string;
  tone: 'accent' | 'default' | 'danger';
  /** Optional second line under the figure, e.g. the bolívar equivalent. */
  secondary?: string;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [PieChart, BarChart, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage implements OnInit {
  private readonly localesService = inject(LocalesService);
  private readonly empresasService = inject(EmpresasService);
  private readonly pagosService = inject(PagosService);
  private readonly egresosService = inject(EgresosService);

  protected readonly categoriaEgresoLabel: Record<CategoriaEgreso, string> = {
    administrativo: 'Administrativo',
    operativo: 'Operativo',
  };

  protected readonly stats = computed<DashboardStat[]>(() => {
    // The owning company is not a tenant, so it never counts here.
    const empresasActivas = this.empresasService
      .all()
      .filter((empresa) => empresa.estado === 'activo' && !empresa.esPropietaria).length;

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Canon only. Condominio and the utilities are money the mall collects and
    // forwards, so counting them here would inflate income against expenses
    // that are already recorded separately.
    const canonDelMes = this.pagosService
      .all()
      .filter((pago) => pago.concepto === 'canon' && pago.fecha.startsWith(yearMonth));

    const ingresosDelMes = canonDelMes.reduce((sum, pago) => sum + pago.monto, 0);

    // Sum of what was actually transferred in bolívares, NOT a conversion of
    // the dollar total: payments made in cash dollars carry no `montoBs`, so
    // this figure covers only the transfers that recorded one.
    const ingresosDelMesBs = canonDelMes.reduce((sum, pago) => sum + (pago.montoBs ?? 0), 0);
    const egresosDelMes = this.egresosService
      .all()
      .filter((egreso) => egreso.fecha.startsWith(yearMonth))
      .reduce((sum, egreso) => sum + egreso.monto, 0);

    return [
      {
        label: 'Balance del mes',
        value: this.formatUsd(ingresosDelMes - egresosDelMes),
        tone: ingresosDelMes - egresosDelMes < 0 ? 'danger' : 'default',
      },
      { label: 'Empresas activas', value: `${empresasActivas}`, tone: 'default' },
      { label: 'Egresos del mes', value: this.formatUsd(egresosDelMes), tone: 'danger' },
      {
        label: 'Ingresos del mes',
        value: this.formatUsd(ingresosDelMes),
        tone: 'default',
        secondary: ingresosDelMesBs > 0 ? this.formatBs(ingresosDelMesBs) : undefined,
      },
    ];
  });

  // Live: most recent rent payments, already sorted newest-first.
  protected readonly recentPayments = computed(() =>
    this.pagosService
      .all()
      .filter((pago) => pago.concepto === 'canon')
      .slice(0, 3),
  );

  // Live: most recent expenses, already sorted newest-first by EgresosService.
  protected readonly recentEgresos = computed(() => this.egresosService.all().slice(0, 3));

  // Live: computed from LocalesService + PagosService.
  protected readonly localesPorPago = computed<PieSegment[]>(() => {
    const locales = this.localesService.all();

    let alDia = 0;
    const parciales: string[] = [];
    const morosos: string[] = [];

    for (const local of locales) {
      const etiqueta = `${local.empresaNombre} — ${local.numeroLocal}`;

      switch (this.pagosService.estadoPago(local.id, local.montoAlquiler)) {
        case 'al-dia':
          alDia++;
          break;
        case 'parcial':
          parciales.push(
            `${etiqueta} (faltan $ ${this.pagosService
              .faltantePorPagar(local.id, local.montoAlquiler)
              .toFixed(2)})`,
          );
          break;
        default:
          morosos.push(etiqueta);
      }
    }

    return [
      { label: 'Al día', value: alDia, color: 'var(--color-success)' },
      { label: 'Pago incompleto', value: parciales.length, color: '#ca8a04', items: parciales },
      { label: 'Morosos', value: morosos.length, color: 'var(--color-danger)', items: morosos },
    ];
  });

  private static readonly monthAbbr = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];

  /**
   * Rent income for the current calendar year, from the first month that has
   * a payment through December. Canon only, same reasoning as the tile above.
   *
   * Not a rolling six-month window: the mall started using the app partway
   * through the year, so that showed a run of empty months before launch.
   * Starting at the first month with data keeps it self-correcting — once a
   * January has payments, the chart simply spans the whole year.
   */
  protected readonly ingresosMensuales = computed<BarDatum[]>(() => {
    const now = new Date();
    const year = now.getFullYear();

    const pagos = this.pagosService
      .all()
      .filter((pago) => pago.concepto === 'canon' && pago.fecha.startsWith(`${year}-`));

    const primerMesConDatos = pagos.reduce(
      (earliest, pago) => Math.min(earliest, Number(pago.fecha.slice(5, 7))),
      now.getMonth() + 1,
    );

    const months: { key: string; label: string }[] = [];
    for (let month = primerMesConDatos; month <= 12; month++) {
      months.push({
        key: `${year}-${String(month).padStart(2, '0')}`,
        label: DashboardPage.monthAbbr[month - 1],
      });
    }

    return months.map(({ key, label }) => ({
      label,
      value: pagos
        .filter((pago) => pago.fecha.startsWith(key))
        .reduce((sum, pago) => sum + pago.monto, 0),
    }));
  });

  ngOnInit(): void {
    this.localesService.load();
    this.empresasService.load();
    this.pagosService.load();
    this.egresosService.load();
  }

  private formatUsd(value: number): string {
    return `$ ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private formatBs(value: number): string {
    return `${value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
  }
}
