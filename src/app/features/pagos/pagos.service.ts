import { Injectable, inject, signal } from '@angular/core';
import { PagoStatus } from '../../core/models/local.model';
import {
  ComprobantePago,
  Pago,
  PagoConcepto,
  TipoTasa,
  esConceptoPorLocal,
  requiereEmpresa,
} from '../../core/models/pago.model';
import { SupabaseService } from '../../core/services/supabase.service';

interface PagoRow {
  id: string;
  numero: number;
  concepto: PagoConcepto;
  empresa_id: string | null;
  local_id: string | null;
  fecha: string;
  monto: number;
  monto_bs: number | null;
  tipo_tasa: TipoTasa;
  usdt_convertido: number | null;
  conversion_fecha: string | null;
  conversion_comprobante_ruta: string | null;
  conversion_comprobante_nombre: string | null;
  descripcion: string | null;
  comprobante_ruta: string | null;
  comprobante_nombre: string | null;
  created_at: string;
  empresas: { nombre_comercial: string } | null;
  locales: { numero_local: string } | null;
  pagos_comprobantes: { id: string; ruta: string; nombre: string }[] | null;
}

const SELECT_WITH_REFS =
  '*, empresas(nombre_comercial), locales(numero_local), pagos_comprobantes(id, ruta, nombre)';

export interface PagoInput {
  concepto: PagoConcepto;
  empresaId: string | null;
  localId: string | null;
  fecha: string;
  monto: number;
  montoBs: number | null;
  tipoTasa: TipoTasa;
  descripcion: string | null;
  /** Files to attach on save; the ones already stored are left alone. */
  comprobanteFiles: File[];
}

export interface ConversionInput {
  /** USDT actually bought with this payment. */
  usdtConvertido: number;
  fecha: string;
  comprobanteFile: File | null;
  eliminarComprobante: boolean;
}

function toRow(pago: PagoInput) {
  return {
    concepto: pago.concepto,
    // The DB rejects an empresa on condominio, so this normalises rather than
    // trusting the form to have cleared it.
    empresa_id: requiereEmpresa(pago.concepto) ? pago.empresaId : null,
    // The DB rejects a local on an empresa-wide concept, so this normalises
    // rather than trusting the form to have cleared it.
    local_id: esConceptoPorLocal(pago.concepto) ? pago.localId : null,
    fecha: pago.fecha,
    monto: pago.monto,
    monto_bs: pago.montoBs,
    tipo_tasa: pago.tipoTasa,
    descripcion: pago.descripcion,
  };
}

function fromRow(row: PagoRow): Pago {
  return {
    id: row.id,
    numero: row.numero,
    concepto: row.concepto,
    empresaId: row.empresa_id,
    empresaNombre: row.empresas?.nombre_comercial ?? '',
    localId: row.local_id,
    localNumero: row.locales?.numero_local ?? null,
    fecha: row.fecha,
    monto: row.monto,
    montoBs: row.monto_bs,
    tipoTasa: row.tipo_tasa,
    usdtConvertido: row.usdt_convertido,
    conversionFecha: row.conversion_fecha,
    conversionComprobanteRuta: row.conversion_comprobante_ruta,
    conversionComprobanteNombre: row.conversion_comprobante_nombre,
    descripcion: row.descripcion,
    comprobantes: (row.pagos_comprobantes ?? []).map(
      (c): ComprobantePago => ({ id: c.id, ruta: c.ruta, nombre: c.nombre }),
    ),
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
      .select(SELECT_WITH_REFS)
      // Ordered by `numero` ascending, so the ID column reads 1, 2, 3… and the
      // newest transaction sits at the bottom. Pages that want the latest
      // rows take them off the END (see the Dashboard panels).
      .order('numero', { ascending: true });

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.pagos.set((data ?? []).map(fromRow));
    this.loading.set(false);
  }

  async add(pago: PagoInput): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase
      .from('pagos')
      .insert(toRow(pago))
      .select('id')
      .single();

    if (error) {
      return { error: error.message };
    }

    const uploadError = await this.uploadComprobantes(data.id, pago.comprobanteFiles);
    if (uploadError) {
      return { error: uploadError };
    }

    await this.load();
    return { error: null };
  }

  async update(id: string, pago: PagoInput): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('pagos').update(toRow(pago)).eq('id', id);

    if (error) {
      return { error: error.message };
    }

    const uploadError = await this.uploadComprobantes(id, pago.comprobanteFiles);
    if (uploadError) {
      return { error: uploadError };
    }

    await this.load();
    return { error: null };
  }

  /**
   * Record what the mall actually got for this payment. Until this runs the
   * row counts for nothing in any balance — see `montoRealizado()`.
   */
  async registrarConversion(
    id: string,
    conversion: ConversionInput,
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('pagos')
      .update({
        usdt_convertido: conversion.usdtConvertido,
        conversion_fecha: conversion.fecha,
        ...(conversion.eliminarComprobante
          ? { conversion_comprobante_ruta: null, conversion_comprobante_nombre: null }
          : {}),
      })
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    if (conversion.comprobanteFile) {
      const { error: uploadError } = await this.uploadComprobanteConversion(
        id,
        conversion.comprobanteFile,
      );
      if (uploadError) {
        return { error: uploadError };
      }
    }

    await this.load();
    return { error: null };
  }

  /** Undo a conversion: the row goes back to the "sin convertir" queue. */
  async anularConversion(id: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('pagos')
      // Both halves together: the check constraint rejects one without the other.
      .update({ usdt_convertido: null, conversion_fecha: null })
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    await this.load();
    return { error: null };
  }

  /** Separate folder from the payment receipt: two different documents. */
  private async uploadComprobanteConversion(
    pagoId: string,
    file: File,
  ): Promise<{ error: string | null }> {
    const extension = file.name.split('.').pop();
    const path = `conversiones/${pagoId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await this.supabase.storage
      .from('documentos')
      .upload(path, file);

    if (uploadError) {
      return { error: uploadError.message };
    }

    const { error: updateError } = await this.supabase
      .from('pagos')
      .update({ conversion_comprobante_ruta: path, conversion_comprobante_nombre: file.name })
      .eq('id', pagoId);

    if (updateError) {
      return { error: updateError.message };
    }

    return { error: null };
  }

  /**
   * Uploads every selected file and registers one `pagos_comprobantes` row
   * each. Returns the first error, or null. Sequential rather than parallel:
   * a failure halfway leaves the files already uploaded registered, which is
   * recoverable, instead of a scatter of orphaned Storage objects.
   */
  private async uploadComprobantes(pagoId: string, files: File[]): Promise<string | null> {
    for (const file of files) {
      const extension = file.name.split('.').pop();
      const path = `pagos/${pagoId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await this.supabase.storage
        .from('documentos')
        .upload(path, file);

      if (uploadError) {
        return uploadError.message;
      }

      const { error: insertError } = await this.supabase
        .from('pagos_comprobantes')
        .insert({ pago_id: pagoId, ruta: path, nombre: file.name });

      if (insertError) {
        return insertError.message;
      }
    }

    return null;
  }

  /** Removes one attachment, Storage object first — the row does not cascade
   *  to the file. */
  async deleteComprobante(comprobante: ComprobantePago): Promise<{ error: string | null }> {
    const { error: storageError } = await this.supabase.storage
      .from('documentos')
      .remove([comprobante.ruta]);

    if (storageError) {
      return { error: storageError.message };
    }

    const { error } = await this.supabase
      .from('pagos_comprobantes')
      .delete()
      .eq('id', comprobante.id);

    if (error) {
      return { error: error.message };
    }

    await this.load();
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

  /**
   * Total canon paid for a local in the current calendar month.
   *
   * Only canon counts: a company can be up to date on its water bill and still
   * owe rent, so counting every concept would mark it as al día.
   *
   * Deliberately sums `monto`, NOT `montoRealizado()`: this answers "did the
   * tenant pay?", and whether the mall has converted the money into USDT yet
   * is the mall's business, not the tenant's. Using the converted figure here
   * would mark every tenant moroso until the admin got round to converting.
   *
   * Matched on the "YYYY-MM" prefix rather than `Date` arithmetic — `fecha` is
   * a date-only string (no time), so parsing it with `new Date()` reads it as
   * UTC midnight and can roll over to the previous month once converted to a
   * negative-offset local timezone (e.g. Venezuela, UTC-4).
   */
  canonPagadoEsteMes(localId: string): number {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return this.pagos()
      .filter(
        (pago) =>
          pago.concepto === 'canon' && pago.localId === localId && pago.fecha.startsWith(yearMonth),
      )
      .reduce((sum, pago) => sum + pago.monto, 0);
  }

  /**
   * Rent status compared against what the unit actually owes. A tenant who
   * paid $1.000 of a $1.152 canon is neither al día nor moroso.
   *
   * Falls back to paid/unpaid when the local has no `montoAlquiler` on record:
   * with no expected amount there is nothing to compare against.
   */
  estadoPago(localId: string, montoAlquiler: number | null): PagoStatus {
    const pagado = this.canonPagadoEsteMes(localId);

    if (pagado <= 0) {
      return 'debe';
    }
    if (!montoAlquiler) {
      return 'al-dia';
    }
    // Half a cent of slack: amounts converted from bolívares land a hair short.
    return pagado >= montoAlquiler - 0.005 ? 'al-dia' : 'parcial';
  }

  /** How much of this month's canon is still outstanding; 0 when settled. */
  faltantePorPagar(localId: string, montoAlquiler: number | null): number {
    if (!montoAlquiler) {
      return 0;
    }
    return Math.max(0, montoAlquiler - this.canonPagadoEsteMes(localId));
  }
}
