import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { CategoriaEgreso } from '../../../core/models/egreso.model';
import { CONCEPTO_LABEL, esConceptoDeIngreso } from '../../../core/models/pago.model';
import {
  PeriodFilter,
  availableYears,
  currentMonth,
  currentYear,
  matchesPeriod,
} from '../../../shared/components/period-filter/period-filter';
import { EgresosService } from '../../egresos/egresos.service';
import { PagosService } from '../../pagos/pagos.service';
import { signal } from '@angular/core';

interface Movimiento {
  id: string;
  tipo: 'ingreso' | 'egreso';
  fecha: string;
  detalle: string;
  monto: number;
}

@Component({
  selector: 'app-balance-page',
  imports: [DecimalPipe, DatePipe, PeriodFilter],
  templateUrl: './balance-page.html',
  styleUrl: './balance-page.scss',
})
export class BalancePage implements OnInit {
  private readonly pagosService = inject(PagosService);
  private readonly egresosService = inject(EgresosService);

  protected readonly isLoading = computed(
    () => this.pagosService.isLoading() || this.egresosService.isLoading(),
  );

  protected readonly categoriaLabel: Record<CategoriaEgreso, string> = {
    administrativo: 'Administrativo',
    operativo: 'Operativo',
  };

  protected readonly anio = signal(currentYear());
  protected readonly mes = signal(currentMonth());

  protected readonly aniosDisponibles = computed(() =>
    availableYears([
      ...this.pagosService.all().map((pago) => pago.fecha),
      ...this.egresosService.all().map((egreso) => egreso.fecha),
    ]),
  );

  protected readonly hasActiveFilters = computed(() => this.anio() !== '' || this.mes() !== '');

  /**
   * Rent collected in the period. Canon only: condominio, Corpoelec and
   * Hidrocapital are money the mall collects and forwards, and the forwarding
   * already shows up as an egreso — counting them would cancel against
   * themselves and make the balance meaningless.
   */
  protected readonly ingresos = computed(() =>
    this.pagosService
      .all()
      .filter(
        (pago) =>
          esConceptoDeIngreso(pago.concepto) && matchesPeriod(pago.fecha, this.anio(), this.mes()),
      )
      .reduce((sum, pago) => sum + pago.monto, 0),
  );

  protected readonly egresos = computed(() =>
    this.egresosService
      .all()
      .filter((egreso) => matchesPeriod(egreso.fecha, this.anio(), this.mes()))
      .reduce((sum, egreso) => sum + egreso.monto, 0),
  );

  protected readonly balance = computed(() => this.ingresos() - this.egresos());

  /** Both sides of the ledger in one list, newest first. */
  protected readonly movimientos = computed<Movimiento[]>(() => {
    const anio = this.anio();
    const mes = this.mes();

    const ingresos: Movimiento[] = this.pagosService
      .all()
      .filter((pago) => esConceptoDeIngreso(pago.concepto) && matchesPeriod(pago.fecha, anio, mes))
      .map((pago) => ({
        id: `pago-${pago.id}`,
        tipo: 'ingreso' as const,
        fecha: pago.fecha,
        // Condominio has no empresa at all, so it falls back to its label.
        detalle: pago.localNumero
          ? `${pago.empresaNombre} — ${pago.localNumero}`
          : pago.empresaNombre || CONCEPTO_LABEL[pago.concepto],
        monto: pago.monto,
      }));

    const egresos: Movimiento[] = this.egresosService
      .all()
      .filter((egreso) => matchesPeriod(egreso.fecha, anio, mes))
      .map((egreso) => ({
        id: `egreso-${egreso.id}`,
        tipo: 'egreso' as const,
        fecha: egreso.fecha,
        detalle: egreso.descripcion || this.categoriaLabel[egreso.categoria],
        monto: egreso.monto,
      }));

    return [...ingresos, ...egresos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  });

  ngOnInit(): void {
    this.pagosService.load();
    this.egresosService.load();
  }

  protected setAnio(value: string): void {
    this.anio.set(value);
  }

  protected setMes(value: string): void {
    this.mes.set(value);
  }

  protected clearAllFilters(): void {
    this.anio.set('');
    this.mes.set('');
  }
}
