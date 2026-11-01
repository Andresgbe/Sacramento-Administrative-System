import { Injectable, inject, signal } from '@angular/core';
import { ModuloId } from '../models/modulo.model';
import { SupabaseService } from './supabase.service';

/**
 * Which sidebar modules are switched on (`modulos_config`).
 *
 * Visibility only: switching a module off hides its menu entry and blocks
 * its route, and never reads or writes the module's own data. A module with
 * no row is on, which is also the state while loading or if the read fails —
 * failing open hides nothing the user had before this feature existed.
 */
@Injectable({ providedIn: 'root' })
export class ModulosService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly deshabilitados = signal<ReadonlySet<string>>(new Set());

  private loaded: Promise<void> | null = null;

  /** Loads once per session; the guards and the sidebar share the result. */
  load(): Promise<void> {
    this.loaded ??= this.fetch();
    return this.loaded;
  }

  private async fetch(): Promise<void> {
    const { data } = await this.supabase
      .from('modulos_config')
      .select('modulo')
      .eq('habilitado', false);

    this.deshabilitados.set(new Set((data ?? []).map((row) => row.modulo as string)));
  }

  habilitado(modulo: string): boolean {
    return !this.deshabilitados().has(modulo);
  }

  /**
   * Upserted, never deleted: switching a module back on flips the same row.
   * The signal moves first and rolls back on failure, so the switch responds
   * immediately — same pattern as the condominio switch.
   */
  async setHabilitado(modulo: ModuloId, habilitado: boolean): Promise<{ error: string | null }> {
    const previo = this.deshabilitados();
    this.aplicar(modulo, habilitado);

    const { data: session } = await this.supabase.auth.getSession();
    const { error } = await this.supabase.from('modulos_config').upsert({
      modulo,
      habilitado,
      actualizado_en: new Date().toISOString(),
      actualizado_por: session.session?.user.id ?? null,
    });

    if (error) {
      this.deshabilitados.set(previo);
      return { error: error.message };
    }
    return { error: null };
  }

  /** Drops the cache on sign-out, so the next user reads their own state. */
  reset(): void {
    this.loaded = null;
    this.deshabilitados.set(new Set());
  }

  private aplicar(modulo: string, habilitado: boolean): void {
    const next = new Set(this.deshabilitados());
    if (habilitado) {
      next.delete(modulo);
    } else {
      next.add(modulo);
    }
    this.deshabilitados.set(next);
  }
}
