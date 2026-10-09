import { Injectable, inject, signal } from '@angular/core';
import { CategoriaEgreso, Egreso } from '../../core/models/egreso.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface EgresoRow {
  id: string;
  numero: number;
  fecha: string;
  monto: number;
  categoria: CategoriaEgreso;
  descripcion: string | null;
  comprobante_ruta: string | null;
  comprobante_nombre: string | null;
  created_at: string;
}

function fromRow(row: EgresoRow): Egreso {
  return {
    id: row.id,
    numero: row.numero,
    fecha: row.fecha,
    monto: row.monto,
    categoria: row.categoria,
    descripcion: row.descripcion,
    comprobanteRuta: row.comprobante_ruta,
    comprobanteNombre: row.comprobante_nombre,
    createdAt: row.created_at,
  };
}

export interface EgresoInput {
  fecha: string;
  monto: number;
  categoria: CategoriaEgreso;
  descripcion: string | null;
  comprobanteFile: File | null;
  eliminarComprobante: boolean;
}

function toRow(egreso: EgresoInput) {
  return {
    fecha: egreso.fecha,
    monto: egreso.monto,
    categoria: egreso.categoria,
    descripcion: egreso.descripcion,
    // Only when the form says so: spreading an unconditional null here would
    // wipe the receipt on every ordinary edit.
    ...(egreso.eliminarComprobante
      ? { comprobante_ruta: null, comprobante_nombre: null }
      : {}),
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

  async add(egreso: EgresoInput): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase
      .from('egresos')
      .insert(toRow(egreso))
      .select('id')
      .single();

    if (error) {
      return { error: error.message };
    }

    if (egreso.comprobanteFile) {
      const { error: uploadError } = await this.uploadComprobante(data.id, egreso.comprobanteFile);
      if (uploadError) {
        return { error: uploadError };
      }
    }

    await this.load();
    return { error: null };
  }

  async update(id: string, egreso: EgresoInput): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('egresos').update(toRow(egreso)).eq('id', id);

    if (error) {
      return { error: error.message };
    }

    if (egreso.comprobanteFile) {
      const { error: uploadError } = await this.uploadComprobante(id, egreso.comprobanteFile);
      if (uploadError) {
        return { error: uploadError };
      }
    }

    await this.load();
    return { error: null };
  }

  /** Same arrangement as pago comprobantes: private bucket, path on the row. */
  private async uploadComprobante(egresoId: string, file: File): Promise<{ error: string | null }> {
    const extension = file.name.split('.').pop();
    const path = `egresos/${egresoId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await this.supabase.storage
      .from('documentos')
      .upload(path, file);

    if (uploadError) {
      return { error: uploadError.message };
    }

    const { error: updateError } = await this.supabase
      .from('egresos')
      .update({ comprobante_ruta: path, comprobante_nombre: file.name })
      .eq('id', egresoId);

    if (updateError) {
      return { error: updateError.message };
    }

    return { error: null };
  }

  async getComprobanteUrl(ruta: string): Promise<{ url: string | null; error: string | null }> {
    const { data, error } = await this.supabase.storage
      .from('documentos')
      .createSignedUrl(ruta, 60 * 60);

    if (error) {
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl, error: null };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('egresos').delete().eq('id', id);

    if (error) {
      return { error: error.message };
    }

    this.egresos.update((current) => current.filter((e) => e.id !== id));
    return { error: null };
  }
}
