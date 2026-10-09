export type TipoTasa = 'BCV' | 'EUR' | 'USD' | 'otra';

export type PagoConcepto = 'canon' | 'condominio' | 'corpoelec' | 'hidrocapital';

export const CONCEPTO_LABEL: Record<PagoConcepto, string> = {
  canon: 'Canon',
  condominio: 'Condominio',
  corpoelec: 'Corpoelec',
  hidrocapital: 'Hidrocapital',
};

/**
 * Billed per unit: a company renting two units owes two of these a month.
 * Corpoelec and Hidrocapital are the exception — one shared meter per
 * business, so they are billed per empresa and carry no local.
 */
export const CONCEPTOS_POR_LOCAL: readonly PagoConcepto[] = ['canon', 'condominio'];

/** Registered in Reporte de pagos and counted as the mall's income. */
export const CONCEPTOS_DE_INGRESO: readonly PagoConcepto[] = ['canon', 'condominio'];

/** Every concepto is billed to a business. */
export function requiereEmpresa(_concepto: PagoConcepto): boolean {
  return true;
}

export function esConceptoDeIngreso(concepto: PagoConcepto): boolean {
  return CONCEPTOS_DE_INGRESO.includes(concepto);
}

export function esConceptoPorLocal(concepto: PagoConcepto): boolean {
  return CONCEPTOS_POR_LOCAL.includes(concepto);
}

/** One file attached to a payment, in the private `documentos` bucket. */
export interface ComprobantePago {
  id: string;
  ruta: string;
  nombre: string;
}

export interface Pago {
  id: string;
  numero: number;
  concepto: PagoConcepto;
  /**
   * Nullable only for the legacy condominio rows, collected as one lump sum
   * for the mall before it was billed per unit. Everything registered now
   * carries an empresa.
   */
  empresaId: string | null;
  empresaNombre: string;
  /** Set for the per-unit concepts (canon, condominio); null for the two
   *  shared-meter services, and on the legacy lump-sum condominio rows. */
  localId: string | null;
  localNumero: string | null;
  fecha: string;
  /** Authoritative amount: rent status and every total compare against this,
   *  since `locales.monto_alquiler` is in dollars. */
  monto: number;
  /** What actually left the tenant's account, when it was paid in bolívares.
   *  A record of the transfer, never an input to a calculation. */
  montoBs: number | null;
  tipoTasa: TipoTasa;
  /**
   * USDT actually bought with this payment, or null while the money is still
   * sitting unconverted. This — not `monto` — is what every income total
   * counts: see `montoRealizado()` below.
   */
  usdtConvertido: number | null;
  conversionFecha: string | null;
  conversionComprobanteRuta: string | null;
  conversionComprobanteNombre: string | null;
  descripcion: string | null;
  /** A payment can arrive as several files; see `pagos_comprobantes`. */
  comprobantes: ComprobantePago[];
  createdAt: string;
}

/**
 * Whether the admin has to record a USDT purchase before this payment counts.
 *
 * Only **canon** does. Canon is agreed in dollars and arrives as dollars or
 * as a transfer at whatever rate was agreed, so what the mall ends up holding
 * is not known until it actually buys USDT.
 *
 * Condominio, Corpoelec and Hidrocapital are typed in bolívares, and the form
 * values them at that day's USDT/Cash rate on the spot — `monto` is already
 * the parallel-dollar figure, so there is nothing left to convert and no
 * "sin convertir" state for them.
 */
export function requiereConversionManual(concepto: PagoConcepto): boolean {
  return concepto === 'canon';
}

/** True once this payment counts: converted, or never needing it. */
export function estaConvertido(pago: Pago): boolean {
  return !requiereConversionManual(pago.concepto) || pago.usdtConvertido !== null;
}

/**
 * What this payment contributes to a balance, in USDT/Cash.
 *
 * For canon, the USDT actually obtained — nothing at all until the conversion
 * is recorded. For the bolívar-denominated concepts, `monto`, which the form
 * already computed at the parallel rate.
 *
 * Every income total in the app goes through this — the Pagos card, the
 * Dashboard tiles and chart, Balance and Reportes. Never sum `pago.monto` for
 * a balance again: for canon that is the nominal figure the tenant paid,
 * which the mall has not necessarily realised yet.
 */
export function montoRealizado(pago: Pago): number {
  if (!requiereConversionManual(pago.concepto)) {
    return pago.monto;
  }
  return pago.usdtConvertido ?? 0;
}

/**
 * The nominal figure still waiting to be converted; 0 once it has been, and
 * always 0 for the concepts that convert on entry. Feeds the "Sin convertir"
 * card, which is a queue of pending work, not income — it is deliberately
 * never added to a balance.
 */
export function montoSinConvertir(pago: Pago): number {
  if (!requiereConversionManual(pago.concepto)) {
    return 0;
  }
  return pago.usdtConvertido === null ? pago.monto : 0;
}
