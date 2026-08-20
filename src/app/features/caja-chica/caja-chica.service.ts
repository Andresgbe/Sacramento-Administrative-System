import { Injectable, computed, inject, signal } from '@angular/core';
import { CajaChicaTipo, MovimientoCajaChica } from '../../core/models/caja-chica.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface MovimientoRow {
  id: string;
  fecha: string;
  tipo: CajaChicaTipo;
  monto: number;
  descripcion: string | null;
  created_at: string;
}

function fromRow(row: MovimientoRow): MovimientoCajaChica {
  return {
    id: row.id,
    fecha: row.fecha,
    tipo: row.tipo,
    monto: row.monto,
    descripcion: row.descripcion,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class CajaChicaService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly movimientos = signal<MovimientoCajaChica[]>([]);
  readonly all = this.movimientos.asReadonly();

  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  readonly balance = computed(() =>
    this.movimientos().reduce(
      (sum, movimiento) =>
        movimiento.tipo === 'ingreso' ? sum + movimiento.monto : sum - movimiento.monto,
      0,
    ),
  );

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('caja_chica')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.movimientos.set((data ?? []).map(fromRow));
    this.loading.set(false);
  }

  async add(movimiento: {
    fecha: string;
    tipo: CajaChicaTipo;
    monto: number;
    descripcion: string | null;
  }): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('caja_chica').insert({
      fecha: movimiento.fecha,
      tipo: movimiento.tipo,
      monto: movimiento.monto,
      descripcion: movimiento.descripcion,
    });

    if (error) {
      return { error: error.message };
    }

    await this.load();
    return { error: null };
  }

  async update(
    id: string,
    movimiento: {
      fecha: string;
      tipo: CajaChicaTipo;
      monto: number;
      descripcion: string | null;
    },
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('caja_chica')
      .update({
        fecha: movimiento.fecha,
        tipo: movimiento.tipo,
        monto: movimiento.monto,
        descripcion: movimiento.descripcion,
      })
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    await this.load();
    return { error: null };
  }
}
