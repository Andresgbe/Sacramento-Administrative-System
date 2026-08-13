import { Injectable, inject, signal } from '@angular/core';
import { Pago, TipoTasa } from '../../core/models/pago.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface PagoRow {
  id: string;
  local_id: string;
  fecha: string;
  monto: number;
  tipo_tasa: TipoTasa;
  descripcion: string | null;
  created_at: string;
  locales: { numero_local: string; nombre_comercial: string } | null;
}

function fromRow(row: PagoRow): Pago {
  return {
    id: row.id,
    localId: row.local_id,
    localNumero: row.locales?.numero_local ?? '',
    localNombre: row.locales?.nombre_comercial ?? '',
    fecha: row.fecha,
    monto: row.monto,
    tipoTasa: row.tipo_tasa,
    descripcion: row.descripcion,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly pagos = signal<Pago[]>([]);
  readonly all = this.pagos.asReadonly();

  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('pagos')
      .select('*, locales(numero_local, nombre_comercial)')
      .order('fecha', { ascending: false });

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.pagos.set((data ?? []).map(fromRow));
    this.loading.set(false);
  }

  async add(pago: {
    localId: string;
    fecha: string;
    monto: number;
    tipoTasa: TipoTasa;
    descripcion: string | null;
  }): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('pagos').insert({
      local_id: pago.localId,
      fecha: pago.fecha,
      monto: pago.monto,
      tipo_tasa: pago.tipoTasa,
      descripcion: pago.descripcion,
    });

    if (error) {
      return { error: error.message };
    }

    await this.load();
    return { error: null };
  }

  hasPaidThisMonth(localId: string): boolean {
    const now = new Date();

    return this.pagos().some((pago) => {
      if (pago.localId !== localId) {
        return false;
      }

      const fecha = new Date(pago.fecha);
      return fecha.getFullYear() === now.getFullYear() && fecha.getMonth() === now.getMonth();
    });
  }
}
