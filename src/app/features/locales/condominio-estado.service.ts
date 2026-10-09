import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';

interface CondominioEstadoRow {
  local_id: string;
  periodo: string;
  pagado: boolean;
}

/** 'YYYY-MM' for today, built from local parts rather than `toISOString()`,
 *  which reports UTC and rolls over a day early in Venezuela (UTC-4). */
export function periodoActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Whether each unit has paid its condominio, for a given month.
 *
 * Set by hand, not derived: a condominio `pago` carries no `local_id` at all
 * (it is one lump sum for the mall), so there is nothing to compute from.
 */
@Injectable({ providedIn: 'root' })
export class CondominioEstadoService {
  private readonly supabase = inject(SupabaseService).client;

  /** `local_id` of every unit marked as paid for `periodo`. Absent = unpaid,
   *  so a unit with no row needs none written until it is switched on. */
  private readonly pagados = signal<Set<string>>(new Set());
  readonly all = this.pagados.asReadonly();

  private readonly periodo = signal(periodoActual());
  readonly currentPeriodo = this.periodo.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  async load(periodo = periodoActual()): Promise<void> {
    this.periodo.set(periodo);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('condominio_estado')
      .select('local_id, periodo, pagado')
      .eq('periodo', periodo)
      .eq('pagado', true);

    if (error) {
      this.error.set(error.message);
      return;
    }

    this.pagados.set(new Set((data ?? []).map((row: CondominioEstadoRow) => row.local_id)));
  }

  haPagado(localId: string): boolean {
    return this.pagados().has(localId);
  }

  /**
   * Flips one unit's status for the current period.
   *
   * Upsert on the (local_id, periodo) unique key: the row may not exist yet,
   * and switching a unit on and off again should reuse the same row instead
   * of accumulating one per click.
   *
   * The signal is updated first so the switch responds immediately, and
   * rolled back if the write fails — otherwise every toggle would wait on a
   * round trip before showing anything.
   */
  async setPagado(localId: string, pagado: boolean): Promise<{ error: string | null }> {
    const anterior = this.pagados();
    this.pagados.update((current) => {
      const next = new Set(current);
      if (pagado) {
        next.add(localId);
      } else {
        next.delete(localId);
      }
      return next;
    });

    const { error } = await this.supabase
      .from('condominio_estado')
      .upsert(
        { local_id: localId, periodo: this.periodo(), pagado },
        { onConflict: 'local_id,periodo' },
      );

    if (error) {
      this.pagados.set(anterior);
      return { error: error.message };
    }

    return { error: null };
  }
}
