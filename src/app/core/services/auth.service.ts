import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { UserRol } from '../models/usuario.model';
import { ModulosService } from './modulos.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly modulosService = inject(ModulosService);

  private readonly session = signal<Session | null>(null);
  readonly currentSession = this.session.asReadonly();

  private readonly rol = signal<UserRol | null>(null);
  readonly currentRol = this.rol.asReadonly();
  readonly isAdmin = computed(() => this.rol() === 'admin');

  /** The one admin above the others (`usuarios.es_principal`): module
   *  switches and the audit log. */
  private readonly principal = signal(false);
  readonly isPrincipal = computed(() => this.isAdmin() && this.principal());

  // Resolves once the initial session has been read from storage.
  readonly ready: Promise<void>;

  // Tracks the most recent role fetch so callers can await the latest value
  // (e.g. right after sign-in, before onAuthStateChange has settled).
  private roleReady: Promise<void> = Promise.resolve();

  constructor() {
    this.ready = this.initSession();

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      this.roleReady = this.loadRol(session);
    });
  }

  private async initSession(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    this.session.set(data.session);
    this.roleReady = this.loadRol(data.session);
    await this.roleReady;
  }

  private async loadRol(session: Session | null): Promise<void> {
    if (!session) {
      this.rol.set(null);
      this.principal.set(false);
      return;
    }

    const { data, error } = await this.supabase
      .from('usuarios')
      .select('rol, es_principal')
      .eq('id', session.user.id)
      .single();

    if (error) {
      // es_principal does not exist until its migration runs; without this
      // fallback a frontend deployed first would strip every admin of the role.
      const { data: soloRol } = await this.supabase
        .from('usuarios')
        .select('rol')
        .eq('id', session.user.id)
        .single();
      this.rol.set(soloRol?.rol ?? null);
      this.principal.set(false);
      return;
    }

    this.rol.set(data?.rol ?? null);
    this.principal.set(data?.es_principal ?? false);
  }

  get isAuthenticated(): boolean {
    return this.session() !== null;
  }

  /** Waits for session + role to be fully resolved, then returns the current role. */
  async waitForRole(): Promise<UserRol | null> {
    await this.ready;
    await this.roleReady;
    return this.rol();
  }

  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  /**
   * Asks the BROWSER's password manager to save the credentials; its own
   * prompt appears and the user decides there. The app must never keep a
   * password itself: in localStorage any injected script could read it.
   * Chrome and Edge support this call. Elsewhere it does nothing and the
   * browser's usual save prompt, driven by the form's autocomplete
   * attributes, is what remains.
   */
  offerToSavePassword(email: string, password: string): void {
    const { PasswordCredential } = window as unknown as {
      PasswordCredential?: new (data: { id: string; password: string }) => Credential;
    };
    if (!PasswordCredential) {
      return;
    }
    navigator.credentials.store(new PasswordCredential({ id: email, password })).catch(() => {
      // Declining or a blocked prompt is not an error: the login already worked.
    });
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this.modulosService.reset();
  }

  async updateOwnPassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ error: string | null }> {
    const email = this.session()?.user.email;
    if (!email) return { error: 'No se pudo verificar la sesión.' };

    const { error: reauthError } = await this.supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (reauthError) return { error: 'La contraseña actual es incorrecta.' };

    const { error } = await this.supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }
}
