import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { CategoriaEgreso } from '../../../core/models/egreso.model';
import {
  CONCEPTO_LABEL,
  esConceptoDeIngreso,
  montoRealizado,
} from '../../../core/models/pago.model';
import {
  PeriodFilter,
  esRangoMesActual,
  finMesActual,
  inicioMesActual,
  matchesRango,
} from '../../../shared/components/period-filter/period-filter';
import { EgresosService } from '../../egresos/egresos.service';
import { PagosService } from '../../pagos/pagos.service';
import { TasasCambioService } from '../../tasas-cambio/tasas-cambio.service';
import { MontoEquivalencias } from '../../../shared/components/monto-equivalencias/monto-equivalencias';
import { signal } from '@angular/core';

interface Movimiento {
  id: string;
  tipo: 'ingreso' | 'egreso';
  fecha: string;
  detalle: string;
  /** Realised: for an income row, the USDT the conversion actually produced. */
  monto: number;
  /** An income still waiting to be converted. It shows as 0 and says so,
   *  because the cards above exclude it and a nominal figure here would not
   *  add up to them. */
  sinConvertir: boolean;
}

@Component({
  selector: 'app-balance-page',
  imports: [DecimalPipe, DatePipe, PeriodFilter, MontoEquivalencias],
  templateUrl: './balance-page.html',
  styleUrl: './balance-page.scss',
})
export class BalancePage implements OnInit {
  private readonly pagosService = inject(PagosService);
  private readonly egresosService = inject(EgresosService);
  // Only to populate it: <app-monto-equivalencias> reads the rates itself,
  // but nothing on this route would have fetched them.
  private readonly tasasCambioService = inject(TasasCambioService);

  protected readonly isLoading = computed(
    () => this.pagosService.isLoading() || this.egresosService.isLoading(),
  );

  protected readonly categoriaLabel: Record<CategoriaEgreso, string> = {
    administrativo: 'Administrativo',
    operativo: 'Operativo',
    remodelacion: 'Remodelación',
  };

  protected readonly fechaInicio = signal(inicioMesActual());
  protected readonly fechaFin = signal(finMesActual());

  protected readonly hasActiveFilters = computed(() => !esRangoMesActual(this.fechaInicio(), this.fechaFin()));

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
          esConceptoDeIngreso(pago.concepto) && matchesRango(pago.fecha, this.fechaInicio(), this.fechaFin()),
      )
      // Realised income only — unconverted payments are not money yet.
      .reduce((sum, pago) => sum + montoRealizado(pago), 0),
  );

  protected readonly egresos = computed(() =>
    this.egresosService
      .all()
      .filter((egreso) => matchesRango(egreso.fecha, this.fechaInicio(), this.fechaFin()))
      .reduce((sum, egreso) => sum + egreso.monto, 0),
  );

  protected readonly balance = computed(() => this.ingresos() - this.egresos());

  /**
   * Accumulated balance across every period on record — deliberately NOT
   * filtered, so it does not move when the año/mes selects do. The three
   * cards beside it answer "how did this month go"; this one answers "where
   * does the mall stand", which is a different question and would be
   * meaningless scoped to a month.
   *
   * Same rules otherwise: canon only on the income side, realised amounts
   * only, so it reconciles with the monthly figures summed over time.
   */
  protected readonly balanceTotal = computed(() => {
    const ingresos = this.pagosService
      .all()
      .filter((pago) => esConceptoDeIngreso(pago.concepto))
      .reduce((sum, pago) => sum + montoRealizado(pago), 0);

    const egresos = this.egresosService
      .all()
      .reduce((sum, egreso) => sum + egreso.monto, 0);

    return ingresos - egresos;
  });

  /** Both sides of the ledger in one list, newest first. */
  protected readonly movimientos = computed<Movimiento[]>(() => {
    const inicio = this.fechaInicio();
    const fin = this.fechaFin();

    const ingresos: Movimiento[] = this.pagosService
      .all()
      .filter((pago) => esConceptoDeIngreso(pago.concepto) && matchesRango(pago.fecha, inicio, fin))
      .map((pago) => ({
        id: `pago-${pago.id}`,
        tipo: 'ingreso' as const,
        fecha: pago.fecha,
        // Condominio has no empresa at all, so it falls back to its label.
        detalle: pago.localNumero
          ? `${pago.empresaNombre} — ${pago.localNumero}`
          : pago.empresaNombre || CONCEPTO_LABEL[pago.concepto],
        monto: montoRealizado(pago),
        sinConvertir: pago.usdtConvertido === null,
      }));

    const egresos: Movimiento[] = this.egresosService
      .all()
      .filter((egreso) => matchesRango(egreso.fecha, inicio, fin))
      .map((egreso) => ({
        id: `egreso-${egreso.id}`,
        tipo: 'egreso' as const,
        fecha: egreso.fecha,
        detalle: egreso.descripcion || this.categoriaLabel[egreso.categoria],
        monto: egreso.monto,
        // Egresos are paid out directly; there is nothing to convert.
        sinConvertir: false,
      }));

    // Oldest first, newest at the bottom — same reading order as the ID
    // columns in Pagos and Egresos. Sorted by date, not by ID: this list
    // mixes two tables whose `numero` sequences are independent, so their
    // ids are not comparable against each other. Newest first.
    return [...ingresos, ...egresos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  });

  ngOnInit(): void {
    this.pagosService.load();
    this.egresosService.load();
    this.tasasCambioService.load();
  }

  protected setFechaInicio(value: string): void {
    this.fechaInicio.set(value);
  }

  protected setFechaFin(value: string): void {
    this.fechaFin.set(value);
  }

  protected clearAllFilters(): void {
    // Back to the current month, not "todos": that is the page's resting
    // state, and clearing into an all-time view silently changed what the
    // totals above were counting.
    this.fechaInicio.set(inicioMesActual());
    this.fechaFin.set(finMesActual());
  }
}
