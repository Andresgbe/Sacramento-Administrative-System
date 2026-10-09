import { Injectable, computed, inject, signal } from '@angular/core';
import { TasasCambio } from '../../core/models/tasas-cambio.model';
import { SupabaseService } from '../../core/services/supabase.service';

@Injectable({ providedIn: 'root' })
export class TasasCambioService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly tasas = signal<TasasCambio | null>(null);
  readonly current = this.tasas.asReadonly();

  /**
   * USDT/Cash — the parallel dollar, and the app's unit of account.
   *
   * Every `monto` stored in the system is already a USDT/Cash dollar: that is
   * what the mall is handed, whether in physical cash or converted from a
   * transfer. So this rate never re-values a stored figure — it only answers
   * "how many bolívares is that", which `aBolivares()` below does.
   *
   * Sourced from Binance P2P (`usdt`), not dolarapi's `paralelo`: the P2P
   * book is the market the money actually changes hands in, while `paralelo`
   * is an average of monitors quoting it.
   */
  readonly usdtCash = computed(() => this.tasas()?.usdt ?? null);

  /** The official rate. Only ever a second reading of the same money. */
  readonly bcv = computed(() => this.tasas()?.bcv ?? null);

  /** Bolívares a USDT/Cash figure is worth today. Null until rates load. */
  aBolivares(montoUsdtCash: number): number | null {
    const tasa = this.usdtCash();
    return tasa ? montoUsdtCash * tasa : null;
  }

  /**
   * The same money read at the official rate — always a LARGER number of
   * dollars than the USDT/Cash figure, because BCV prices the dollar lower.
   * It is the figure that would appear on official books, never a total the
   * app computes anything from.
   */
  aDolaresBcv(montoUsdtCash: number): number | null {
    const bcv = this.bcv();
    const bolivares = this.aBolivares(montoUsdtCash);
    return bcv && bolivares !== null ? bolivares / bcv : null;
  }

  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.functions.invoke<TasasCambio>('tasas-cambio');

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.tasas.set(data);
    this.loading.set(false);
  }
}
