import { Injectable, inject } from '@angular/core';
import { Documento, DocumentoTipo } from '../../core/models/documento.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface DocumentoRow {
  id: string;
  local_id: string;
  tipo: DocumentoTipo;
  nombre_archivo: string;
  ruta: string;
  created_at: string;
}

function fromRow(row: DocumentoRow): Documento {
  return {
    id: row.id,
    localId: row.local_id,
    tipo: row.tipo,
    nombreArchivo: row.nombre_archivo,
    ruta: row.ruta,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly supabase = inject(SupabaseService).client;

  async upload(
    localId: string,
    tipo: DocumentoTipo,
    file: File,
  ): Promise<{ error: string | null }> {
    const extension = file.name.split('.').pop();
    const path = `${localId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await this.supabase.storage
      .from('documentos')
      .upload(path, file);

    if (uploadError) {
      return { error: uploadError.message };
    }

    const { error: insertError } = await this.supabase.from('documentos').insert({
      local_id: localId,
      tipo,
      nombre_archivo: file.name,
      ruta: path,
    });

    if (insertError) {
      return { error: insertError.message };
    }

    return { error: null };
  }

  async listByLocal(localId: string): Promise<{ documentos: Documento[]; error: string | null }> {
    const { data, error } = await this.supabase
      .from('documentos')
      .select('*')
      .eq('local_id', localId)
      .order('created_at', { ascending: false });

    if (error) {
      return { documentos: [], error: error.message };
    }

    return { documentos: (data ?? []).map(fromRow), error: null };
  }

  async getSignedUrl(ruta: string): Promise<{ url: string | null; error: string | null }> {
    const { data, error } = await this.supabase.storage
      .from('documentos')
      .createSignedUrl(ruta, 60 * 60);

    if (error) {
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl, error: null };
  }
}
