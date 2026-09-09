import { Injectable, inject, signal } from '@angular/core';
import { EmpresaEstado } from '../../core/models/empresa.model';
import { Local } from '../../core/models/local.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface LocalRow {
  id: string;
  empresa_id: string;
  numero_local: string;
  piso: string | null;
  area_m2: number | null;
  monto_alquiler: number | null;
  created_at: string;
  empresas: {
    nombre_comercial: string;
    imagen_url: string | null;
    estado: EmpresaEstado;
  } | null;
}

const SELECT_WITH_EMPRESA = '*, empresas(nombre_comercial, imagen_url, estado)';

function fromRow(row: LocalRow): Local {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    numeroLocal: row.numero_local,
    piso: row.piso,
    areaM2: row.area_m2,
    montoAlquiler: row.monto_alquiler,
    createdAt: row.created_at,
    empresaNombre: row.empresas?.nombre_comercial ?? '',
    empresaImagenUrl: row.empresas?.imagen_url ?? null,
    empresaEstado: row.empresas?.estado ?? 'inactivo',
  };
}

// Groups every local of the same business together, then orders its units
// naturally ("PB-2" before "PB-10"). Done here rather than in the query
// because PostgREST orders the embedded empresa, not the parent rows.
function byEmpresaThenNumero(a: Local, b: Local): number {
  const empresa = a.empresaNombre.localeCompare(b.empresaNombre, 'es', { sensitivity: 'base' });
  return empresa !== 0
    ? empresa
    : a.numeroLocal.localeCompare(b.numeroLocal, 'es', { numeric: true, sensitivity: 'base' });
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
      .select(SELECT_WITH_EMPRESA)
      .is('deleted_at', null);

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.locales.set((data ?? []).map(fromRow).sort(byEmpresaThenNumero));
    this.loading.set(false);
  }

  async add(
    local: Omit<Local, 'id' | 'createdAt' | 'empresaNombre' | 'empresaImagenUrl' | 'empresaEstado'>,
  ): Promise<{ local: Local | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('locales')
      .insert({
        empresa_id: local.empresaId,
        numero_local: local.numeroLocal,
        piso: local.piso,
        area_m2: local.areaM2,
        monto_alquiler: local.montoAlquiler,
      })
      .select(SELECT_WITH_EMPRESA)
      .single();

    if (error) {
      return { local: null, error: error.message };
    }

    const created = fromRow(data);
    this.locales.update((current) => [...current, created].sort(byEmpresaThenNumero));
    return { local: created, error: null };
  }

  async getById(id: string): Promise<{ local: Local | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('locales')
      .select(SELECT_WITH_EMPRESA)
      .eq('id', id)
      .single();

    if (error) {
      return { local: null, error: error.message };
    }

    return { local: fromRow(data), error: null };
  }

  async update(
    id: string,
    changes: Omit<
      Local,
      'id' | 'createdAt' | 'areaM2' | 'empresaNombre' | 'empresaImagenUrl' | 'empresaEstado'
    >,
  ): Promise<{ local: Local | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('locales')
      .update({
        empresa_id: changes.empresaId,
        numero_local: changes.numeroLocal,
        piso: changes.piso,
        monto_alquiler: changes.montoAlquiler,
      })
      .eq('id', id)
      .select(SELECT_WITH_EMPRESA)
      .single();

    if (error) {
      return { local: null, error: error.message };
    }

    const updated = fromRow(data);
    this.locales.update((current) =>
      current.map((l) => (l.id === id ? updated : l)).sort(byEmpresaThenNumero),
    );
    return { local: updated, error: null };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    // Soft delete: pagos.local_id is `on delete restrict`, so a local with
    // payment history can't be hard-deleted — and shouldn't be, since past
    // pagos need to keep showing the local's name.
    const { error } = await this.supabase
      .from('locales')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    this.locales.update((current) => current.filter((l) => l.id !== id));
    return { error: null };
  }
}
