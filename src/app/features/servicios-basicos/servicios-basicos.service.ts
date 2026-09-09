import { Injectable, inject, signal } from '@angular/core';
import { FacturaServicio, ServicioConcepto } from '../../core/models/factura-servicio.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface FacturaRow {
  id: string;
  concepto: ServicioConcepto;
  periodo: string;
  created_at: string;
  facturas_servicio_fotos: { id: string; ruta: string; nombre_archivo: string }[] | null;
}

const SELECT_WITH_FOTOS = '*, facturas_servicio_fotos(id, ruta, nombre_archivo)';

function fromRow(row: FacturaRow): FacturaServicio {
  return {
    id: row.id,
    concepto: row.concepto,
    periodo: row.periodo,
    fotos: (row.facturas_servicio_fotos ?? []).map((foto) => ({
      id: foto.id,
      ruta: foto.ruta,
      nombreArchivo: foto.nombre_archivo,
    })),
    createdAt: row.created_at,
  };
}

export interface FacturaInput {
  concepto: ServicioConcepto;
  periodo: string;
}

@Injectable({ providedIn: 'root' })
export class ServiciosBasicosService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly facturas = signal<FacturaServicio[]>([]);
  readonly all = this.facturas.asReadonly();

  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('facturas_servicio')
      .select(SELECT_WITH_FOTOS)
      .order('periodo', { ascending: false });

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.facturas.set((data ?? []).map(fromRow));
    this.loading.set(false);
  }

  async add(factura: FacturaInput, fotos: File[]): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase
      .from('facturas_servicio')
      .insert(toRow(factura))
      .select('id')
      .single();

    if (error) {
      return { error: error.message };
    }

    const uploadError = await this.uploadFotos(data.id, fotos);
    await this.load();
    return { error: uploadError };
  }

  async update(
    id: string,
    factura: FacturaInput,
    fotos: File[],
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('facturas_servicio')
      .update(toRow(factura))
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    const uploadError = await this.uploadFotos(id, fotos);
    await this.load();
    return { error: uploadError };
  }

  async delete(id: string): Promise<{ error: string | null }> {
    // The photo rows cascade, but the Storage objects don't — remove those
    // first so deleting a bill doesn't leave orphan files in the bucket.
    const factura = this.facturas().find((f) => f.id === id);
    if (factura?.fotos.length) {
      await this.supabase.storage.from('documentos').remove(factura.fotos.map((f) => f.ruta));
    }

    const { error } = await this.supabase.from('facturas_servicio').delete().eq('id', id);

    if (error) {
      return { error: error.message };
    }

    this.facturas.update((current) => current.filter((f) => f.id !== id));
    return { error: null };
  }

  async deleteFoto(fotoId: string, ruta: string): Promise<{ error: string | null }> {
    await this.supabase.storage.from('documentos').remove([ruta]);

    const { error } = await this.supabase.from('facturas_servicio_fotos').delete().eq('id', fotoId);

    if (error) {
      return { error: error.message };
    }

    await this.load();
    return { error: null };
  }

  async getFotoUrl(ruta: string): Promise<{ url: string | null; error: string | null }> {
    const { data, error } = await this.supabase.storage
      .from('documentos')
      .createSignedUrl(ruta, 60 * 60);

    if (error) {
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl, error: null };
  }

  /** Uploads are best-effort metadata: the bill itself is already saved, so a
   *  failed photo returns its message without undoing the row. */
  private async uploadFotos(facturaId: string, fotos: File[]): Promise<string | null> {
    for (const foto of fotos) {
      const extension = foto.name.split('.').pop();
      const path = `facturas/${facturaId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await this.supabase.storage
        .from('documentos')
        .upload(path, foto);

      if (uploadError) {
        return uploadError.message;
      }

      const { error: insertError } = await this.supabase
        .from('facturas_servicio_fotos')
        .insert({ factura_id: facturaId, ruta: path, nombre_archivo: foto.name });

      if (insertError) {
        return insertError.message;
      }
    }

    return null;
  }
}

function toRow(factura: FacturaInput) {
  return {
    concepto: factura.concepto,
    periodo: factura.periodo,
  };
}
