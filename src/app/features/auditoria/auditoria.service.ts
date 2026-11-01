import { Injectable, inject, signal } from '@angular/core';
import { OperacionAuditoria, RegistroAuditoria } from '../../core/models/auditoria.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface AuditoriaRow {
  id: number;
  fecha: string;
  tabla: string;
  operacion: OperacionAuditoria;
  registro_id: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  usuario_email: string | null;
}

/** Newest entries kept in memory. The log only grows, so it is capped. */
const LIMITE = 2000;

/**
 * Read-only by design: the log is written only by a database trigger, and
 * RLS gives nobody, the principal included, a way to edit or erase it.
 */
@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly registros = signal<RegistroAuditoria[]>([]);
  readonly all = this.registros.asReadonly();

  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('auditoria')
      .select('id, fecha, tabla, operacion, registro_id, antes, despues, usuario_email')
      .order('fecha', { ascending: false })
      .limit(LIMITE);

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.registros.set(
      ((data ?? []) as AuditoriaRow[]).map((row) => ({
        id: row.id,
        fecha: row.fecha,
        tabla: row.tabla,
        operacion: row.operacion,
        registroId: row.registro_id,
        antes: row.antes,
        despues: row.despues,
        usuarioEmail: row.usuario_email,
      })),
    );
    this.loading.set(false);
  }
}
