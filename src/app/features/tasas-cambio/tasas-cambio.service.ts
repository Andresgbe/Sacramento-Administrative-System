import { Injectable, inject, signal } from '@angular/core';
import { TasasCambio } from '../../core/models/tasas-cambio.model';
import { SupabaseService } from '../../core/services/supabase.service';

@Injectable({ providedIn: 'root' })
export class TasasCambioService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly tasas = signal<TasasCambio | null>(null);
  readonly current = this.tasas.asReadonly();

  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.functions.invoke<TasasCambio>('tasas-cambio');

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.tasas.set(data);
    this.loading.set(false);
  }
}
