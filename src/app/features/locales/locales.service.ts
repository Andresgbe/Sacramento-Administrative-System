import { Injectable, inject, signal } from '@angular/core';
import { Local, LocalEstado } from '../../core/models/local.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface LocalRow {
  id: string;
  numero_local: string;
  nombre_comercial: string;
  imagen_url: string | null;
  piso: string | null;
  rif: string | null;
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
    rif: row.rif,
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

  async uploadImage(file: File): Promise<{ url: string | null; error: string | null }> {
    const extension = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${extension}`;

    const { error } = await this.supabase.storage.from('locales').upload(path, file);

    if (error) {
      return { url: null, error: error.message };
    }

    const { data } = this.supabase.storage.from('locales').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  async add(
    local: Omit<Local, 'id' | 'createdAt'>,
  ): Promise<{ local: Local | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('locales')
      .insert({
        numero_local: local.numeroLocal,
        nombre_comercial: local.nombreComercial,
        imagen_url: local.imagenUrl,
        piso: local.piso,
        rif: local.rif,
        area_m2: local.areaM2,
        monto_alquiler: local.montoAlquiler,
        estado: local.estado,
      })
      .select()
      .single();

    if (error) {
      return { local: null, error: error.message };
    }

    const created = fromRow(data);
    this.locales.update((current) => [created, ...current]);
    return { local: created, error: null };
  }

  async getById(id: string): Promise<{ local: Local | null; error: string | null }> {
    const { data, error } = await this.supabase.from('locales').select('*').eq('id', id).single();

    if (error) {
      return { local: null, error: error.message };
    }

    return { local: fromRow(data), error: null };
  }

  async update(
    id: string,
    changes: Omit<Local, 'id' | 'createdAt' | 'areaM2'>,
  ): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase
      .from('locales')
      .update({
        numero_local: changes.numeroLocal,
        nombre_comercial: changes.nombreComercial,
        imagen_url: changes.imagenUrl,
        piso: changes.piso,
        rif: changes.rif,
        monto_alquiler: changes.montoAlquiler,
        estado: changes.estado,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    this.locales.update((current) => current.map((l) => (l.id === id ? fromRow(data) : l)));
    return { error: null };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('locales').delete().eq('id', id);

    if (error) {
      return { error: error.message };
    }

    this.locales.update((current) => current.filter((l) => l.id !== id));
    return { error: null };
  }
}
