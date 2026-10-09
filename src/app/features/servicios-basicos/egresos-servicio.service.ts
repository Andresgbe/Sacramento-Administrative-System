import { Injectable, inject, signal } from '@angular/core';
import { EgresoServicio } from '../../core/models/egreso-servicio.model';
import { ServicioConcepto } from '../../core/models/factura-servicio.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface EgresoServicioRow {
  id: string;
  numero: number;
  concepto: ServicioConcepto;
  fecha: string;
  monto_bs: number;
  monto_usd: number | null;
  tasa: number | null;
  descripcion: string | null;
  created_at: string;
}

function fromRow(row: EgresoServicioRow): EgresoServicio {
  return {
    id: row.id,
    numero: row.numero,
    concepto: row.concepto,
    fecha: row.fecha,
    montoBs: row.monto_bs,
    montoUsd: row.monto_usd,
    tasa: row.tasa,
    descripcion: row.descripcion,
    createdAt: row.created_at,
  };
}

export interface EgresoServicioInput {
  concepto: ServicioConcepto;
  fecha: string;
  montoBs: number;
  montoUsd: number | null;
  tasa: number | null;
  descripcion: string | null;
}

function toRow(egreso: EgresoServicioInput) {
  return {
    concepto: egreso.concepto,
    fecha: egreso.fecha,
    monto_bs: egreso.montoBs,
    monto_usd: egreso.montoUsd,
    tasa: egreso.tasa,
    descripcion: egreso.descripcion,
  };
}

@Injectable({ providedIn: 'root' })
export class EgresosServicioService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly egresos = signal<EgresoServicio[]>([]);
  readonly all = this.egresos.asReadonly();

  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('egresos_servicio')
      .select('*')
      // Ordered by `numero` ascending, so the ID column reads 1, 2, 3… and the
      // newest transaction sits at the bottom. Pages that want the latest
      // rows take them off the END (see the Dashboard panels).
      .order('numero', { ascending: true });

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.egresos.set((data ?? []).map(fromRow));
    this.loading.set(false);
  }

  async add(egreso: EgresoServicioInput): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('egresos_servicio').insert(toRow(egreso));

    if (error) {
      return { error: error.message };
    }

    await this.load();
    return { error: null };
  }

  async update(id: string, egreso: EgresoServicioInput): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('egresos_servicio')
      .update(toRow(egreso))
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    await this.load();
    return { error: null };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('egresos_servicio').delete().eq('id', id);

    if (error) {
      return { error: error.message };
    }

    this.egresos.update((current) => current.filter((e) => e.id !== id));
    return { error: null };
  }
}
