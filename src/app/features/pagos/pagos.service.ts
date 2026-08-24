import { Injectable, inject, signal } from '@angular/core';
import { Pago, TipoTasa } from '../../core/models/pago.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface PagoRow {
  id: string;
  numero: number;
  local_id: string;
  fecha: string;
  monto: number;
  tipo_tasa: TipoTasa;
  descripcion: string | null;
  comprobante_ruta: string | null;
  comprobante_nombre: string | null;
  created_at: string;
  locales: { nombre_comercial: string } | null;
}

function fromRow(row: PagoRow): Pago {
  return {
    id: row.id,
    numero: row.numero,
    localId: row.local_id,
    localNombre: row.locales?.nombre_comercial ?? '',
    fecha: row.fecha,
    monto: row.monto,
    tipoTasa: row.tipo_tasa,
    descripcion: row.descripcion,
    comprobanteRuta: row.comprobante_ruta,
    comprobanteNombre: row.comprobante_nombre,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly pagos = signal<Pago[]>([]);
  readonly all = this.pagos.asReadonly();

  private readonly loading = signal(false);
  readonly isLoading = this.loading.asReadonly();

  private readonly error = signal<string | null>(null);
  readonly loadError = this.error.asReadonly();

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('pagos')
      .select('*, locales(nombre_comercial)')
      .order('fecha', { ascending: false });

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.pagos.set((data ?? []).map(fromRow));
    this.loading.set(false);
  }

  async add(pago: {
    localId: string;
    fecha: string;
    monto: number;
    tipoTasa: TipoTasa;
    descripcion: string | null;
    comprobanteFile: File | null;
  }): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase
      .from('pagos')
      .insert({
        local_id: pago.localId,
        fecha: pago.fecha,
        monto: pago.monto,
        tipo_tasa: pago.tipoTasa,
        descripcion: pago.descripcion,
      })
      .select('id')
      .single();

    if (error) {
      return { error: error.message };
    }

    if (pago.comprobanteFile) {
      const { error: uploadError } = await this.uploadComprobante(data.id, pago.comprobanteFile);
      if (uploadError) {
        return { error: uploadError };
      }
    }

    await this.load();
    return { error: null };
  }

  async update(
    id: string,
    pago: {
      localId: string;
      fecha: string;
      monto: number;
      tipoTasa: TipoTasa;
      descripcion: string | null;
      comprobanteFile: File | null;
    },
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('pagos')
      .update({
        local_id: pago.localId,
        fecha: pago.fecha,
        monto: pago.monto,
        tipo_tasa: pago.tipoTasa,
        descripcion: pago.descripcion,
      })
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    if (pago.comprobanteFile) {
      const { error: uploadError } = await this.uploadComprobante(id, pago.comprobanteFile);
      if (uploadError) {
        return { error: uploadError };
      }
    }

    await this.load();
    return { error: null };
  }

  private async uploadComprobante(
    pagoId: string,
    file: File,
  ): Promise<{ error: string | null }> {
    const extension = file.name.split('.').pop();
    const path = `pagos/${pagoId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await this.supabase.storage
      .from('documentos')
      .upload(path, file);

    if (uploadError) {
      return { error: uploadError.message };
    }

    const { error: updateError } = await this.supabase
      .from('pagos')
      .update({ comprobante_ruta: path, comprobante_nombre: file.name })
      .eq('id', pagoId);

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
    const { error } = await this.supabase.from('pagos').delete().eq('id', id);

    if (error) {
      return { error: error.message };
    }

    this.pagos.update((current) => current.filter((p) => p.id !== id));
    return { error: null };
  }

  hasPaidThisMonth(localId: string): boolean {
    return this.monthsSinceLastPayment(localId) === 0;
  }

  /**
   * Whole months elapsed since the local's most recent payment (0 = paid
   * this month). Returns null if the local has never made a payment.
   *
   * Computed from "YYYY-MM" parts rather than `Date` arithmetic — `fecha` is
   * a date-only string (no time), so parsing it with `new Date()` reads it
   * as UTC midnight and can roll over to the previous month once converted
   * to a negative-offset local timezone (e.g. Venezuela, UTC-4).
   */
  monthsSinceLastPayment(localId: string): number | null {
    const pagosDelLocal = this.pagos().filter((pago) => pago.localId === localId);

    if (pagosDelLocal.length === 0) {
      return null;
    }

    const ultimoPago = pagosDelLocal.reduce((latest, pago) =>
      pago.fecha > latest.fecha ? pago : latest,
    );

    const [year, month] = ultimoPago.fecha.split('-').map(Number);
    const now = new Date();

    return (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  }
}
