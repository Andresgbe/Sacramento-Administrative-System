import { Injectable, inject, signal } from '@angular/core';
import { Local, LocalEstado } from '../../core/models/local.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface LocalRow {
  id: string;
  numero_local: string;
  nombre_comercial: string;
  imagen_url: string | null;
  piso: string | null;
  area_m2: number | null;
  monto_alquiler: number | null;
  estado: LocalEstado;
  created_at: string;
}

function fromRow(row: LocalRow): Local {
  return {
    id: row.id,
    numeroLocal: row.numero_local,
    nombreComercial: row.nombre_comercial,
    imagenUrl: row.imagen_url,
    piso: row.piso,
    areaM2: row.area_m2,
    montoAlquiler: row.monto_alquiler,
    estado: row.estado,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class LocalesService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly locales = signal<Local[]>([]);
  readonly all = this.locales.asReadonly();

  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('locales')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.locales.set((data ?? []).map(fromRow));
    this.loading.set(false);
  }

  async add(local: Omit<Local, 'id' | 'createdAt'>): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase
      .from('locales')
      .insert({
        numero_local: local.numeroLocal,
        nombre_comercial: local.nombreComercial,
        imagen_url: local.imagenUrl,
        piso: local.piso,
        area_m2: local.areaM2,
        monto_alquiler: local.montoAlquiler,
        estado: local.estado,
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    this.locales.update((current) => [fromRow(data), ...current]);
    return { error: null };
  }
}
