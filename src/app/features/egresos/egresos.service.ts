import { Injectable, inject, signal } from '@angular/core';
import { CategoriaEgreso, Egreso } from '../../core/models/egreso.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface EgresoRow {
  id: string;
  fecha: string;
  monto: number;
  categoria: CategoriaEgreso;
  descripcion: string | null;
  created_at: string;
}

function fromRow(row: EgresoRow): Egreso {
  return {
    id: row.id,
    fecha: row.fecha,
    monto: row.monto,
    categoria: row.categoria,
    descripcion: row.descripcion,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class EgresosService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly egresos = signal<Egreso[]>([]);
  readonly all = this.egresos.asReadonly();

  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('egresos')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.egresos.set((data ?? []).map(fromRow));
    this.loading.set(false);
  }

  async add(egreso: {
    fecha: string;
    monto: number;
    categoria: CategoriaEgreso;
    descripcion: string | null;
  }): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('egresos').insert({
      fecha: egreso.fecha,
      monto: egreso.monto,
      categoria: egreso.categoria,
      descripcion: egreso.descripcion,
    });

    if (error) {
      return { error: error.message };
    }

    await this.load();
    return { error: null };
  }
}
