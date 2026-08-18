import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { UserRol } from '../models/usuario.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly session = signal<Session | null>(null);
  readonly currentSession = this.session.asReadonly();

  private readonly rol = signal<UserRol | null>(null);
  readonly currentRol = this.rol.asReadonly();
  readonly isAdmin = computed(() => this.rol() === 'admin');

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
      return;
    }

    const { data } = await this.supabase
      .from('usuarios')
      .select('rol')
      .eq('id', session.user.id)
      .single();

    this.rol.set(data?.rol ?? null);
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

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }
}
