import { Injectable, inject, signal } from '@angular/core';
import { Empresa, EmpresaEstado } from '../../core/models/empresa.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface EmpresaRow {
  id: string;
  nombre_comercial: string;
  rif: string | null;
  imagen_url: string | null;
  estado: EmpresaEstado;
  es_propietaria: boolean;
  created_at: string;
}

function fromRow(row: EmpresaRow): Empresa {
  return {
    id: row.id,
    nombreComercial: row.nombre_comercial,
    rif: row.rif,
    imagenUrl: row.imagen_url,
    estado: row.estado,
    esPropietaria: row.es_propietaria,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class EmpresasService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly empresas = signal<Empresa[]>([]);
  readonly all = this.empresas.asReadonly();

  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('empresas')
      .select('*')
      .is('deleted_at', null)
      .order('nombre_comercial');

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.empresas.set((data ?? []).map(fromRow));
    this.loading.set(false);
  }

  // Logos still live in the "locales" bucket: renaming it would break the
  // public URLs already stored on existing rows.
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
    empresa: Omit<Empresa, 'id' | 'createdAt' | 'esPropietaria'>,
  ): Promise<{ empresa: Empresa | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('empresas')
      .insert({
        nombre_comercial: empresa.nombreComercial,
        rif: empresa.rif,
        imagen_url: empresa.imagenUrl,
        estado: empresa.estado,
      })
      .select()
      .single();

    if (error) {
      return { empresa: null, error: error.message };
    }

    const created = fromRow(data);
    this.empresas.update((current) =>
      [...current, created].sort((a, b) => a.nombreComercial.localeCompare(b.nombreComercial)),
    );
    return { empresa: created, error: null };
  }

  async getById(id: string): Promise<{ empresa: Empresa | null; error: string | null }> {
    const { data, error } = await this.supabase.from('empresas').select('*').eq('id', id).single();

    if (error) {
      return { empresa: null, error: error.message };
    }

    return { empresa: fromRow(data), error: null };
  }

  async update(
    id: string,
    changes: Omit<Empresa, 'id' | 'createdAt' | 'esPropietaria'>,
  ): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase
      .from('empresas')
      .update({
        nombre_comercial: changes.nombreComercial,
        rif: changes.rif,
        imagen_url: changes.imagenUrl,
        estado: changes.estado,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    this.empresas.update((current) => current.map((e) => (e.id === id ? fromRow(data) : e)));
    return { error: null };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    // Soft-deleting the empresa would leave its locales pointing at a row the
    // rest of the app filters out, so they have to be reassigned first.
    const { count, error: countError } = await this.supabase
      .from('locales')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', id)
      .is('deleted_at', null);

    if (countError) {
      return { error: countError.message };
    }

    if (count) {
      return {
        error: `No se puede eliminar: la empresa todavía tiene ${count} local(es) asignado(s).`,
      };
    }

    // Soft delete, same reasoning as locales: locales.empresa_id is
    // `on delete restrict`, and past pagos still need to resolve the name.
    const { error } = await this.supabase
      .from('empresas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    this.empresas.update((current) => current.filter((e) => e.id !== id));
    return { error: null };
  }
}
