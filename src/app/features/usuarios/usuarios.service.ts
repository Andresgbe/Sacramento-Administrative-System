import { Injectable, inject, signal } from '@angular/core';
import { Usuario } from '../../core/models/usuario.model';
import { SupabaseService } from '../../core/services/supabase.service';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly usuarios = signal<Usuario[]>([]);
  readonly all = this.usuarios.asReadonly();

  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.functions.invoke('manage-users', {
      body: { action: 'list' },
    });

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    if (data?.error) {
      this.error.set(data.error);
      this.loading.set(false);
      return;
    }

    this.usuarios.set(data.usuarios ?? []);
    this.loading.set(false);
  }

  async create(payload: {
    email: string;
    password: string;
    nombreCompleto: string;
  }): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase.functions.invoke('manage-users', {
      body: { action: 'create', ...payload },
    });

    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };

    await this.load();
    return { error: null };
  }

  async updatePassword(userId: string, newPassword: string): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase.functions.invoke('manage-users', {
      body: { action: 'update-password', userId, newPassword },
    });

    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };
    return { error: null };
  }

  async updateProfile(userId: string, nombreCompleto: string): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase.functions.invoke('manage-users', {
      body: { action: 'update-profile', userId, nombreCompleto },
    });

    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };

    await this.load();
    return { error: null };
  }
}
