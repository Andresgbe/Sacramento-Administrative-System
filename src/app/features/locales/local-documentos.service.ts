import { Injectable, inject } from '@angular/core';
import { LocalDocumento } from '../../core/models/local.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface LocalDocumentoRow {
  id: string;
  ruta: string;
  nombre: string;
}

function fromRow(row: LocalDocumentoRow): LocalDocumento {
  return { id: row.id, ruta: row.ruta, nombre: row.nombre };
}

/** The files attached to one local (`locales_documentos`). */
@Injectable({ providedIn: 'root' })
export class LocalDocumentosService {
  private readonly supabase = inject(SupabaseService).client;

  async list(localId: string): Promise<{ documentos: LocalDocumento[]; error: string | null }> {
    const { data, error } = await this.supabase
      .from('locales_documentos')
      .select('id, ruta, nombre')
      .eq('local_id', localId)
      .order('created_at', { ascending: false });

    if (error) {
      return { documentos: [], error: error.message };
    }
    return { documentos: (data ?? []).map(fromRow), error: null };
  }

  async upload(
    localId: string,
    file: File,
  ): Promise<{ documento: LocalDocumento | null; error: string | null }> {
    const extension = file.name.split('.').pop();
    const ruta = `locales/${localId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await this.supabase.storage
      .from('documentos')
      .upload(ruta, file);

    if (uploadError) {
      return { documento: null, error: uploadError.message };
    }

    const { data, error } = await this.supabase
      .from('locales_documentos')
      .insert({ local_id: localId, ruta, nombre: file.name })
      .select('id, ruta, nombre')
      .single();

    if (error) {
      return { documento: null, error: error.message };
    }
    return { documento: fromRow(data), error: null };
  }

  /**
   * Removes the file from the local but deliberately keeps the Storage object,
   * unlike comprobantes: the client asked that nothing be lost, and the audit
   * log keeps this row's `ruta`, so a contract removed by mistake can be found.
   */
  async remove(documento: LocalDocumento): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('locales_documentos')
      .delete()
      .eq('id', documento.id);

    return { error: error?.message ?? null };
  }

  async getUrl(ruta: string): Promise<{ url: string | null; error: string | null }> {
    const { data, error } = await this.supabase.storage
      .from('documentos')
      .createSignedUrl(ruta, 60 * 60);

    if (error) {
      return { url: null, error: error.message };
    }
    return { url: data.signedUrl, error: null };
  }
}
