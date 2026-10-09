export type TipoTasa = 'BCV' | 'EUR' | 'USD' | 'otra';

export type PagoConcepto = 'canon' | 'condominio' | 'corpoelec' | 'hidrocapital';

export const CONCEPTO_LABEL: Record<PagoConcepto, string> = {
  canon: 'Canon',
  condominio: 'Condominio',
  corpoelec: 'Corpoelec',
  hidrocapital: 'Hidrocapital',
};

/** Canon is billed per unit; the other three are billed once per empresa. */
export const CONCEPTOS_POR_LOCAL: readonly PagoConcepto[] = ['canon'];

/** Registered in Reporte de pagos and counted as the mall's income. */
export const CONCEPTOS_DE_INGRESO: readonly PagoConcepto[] = ['canon', 'condominio'];

/** Condominio is a single monthly figure for the mall, not billed per tenant. */
export function requiereEmpresa(concepto: PagoConcepto): boolean {
  return concepto !== 'condominio';
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
  /** Null for `condominio`, which is collected as one lump sum for the mall
   *  rather than billed to any particular business. */
  empresaId: string | null;
  empresaNombre: string;
  /** Only set for per-unit concepts (canon); null for empresa-wide services. */
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

/** True once the mall has bought USDT with this payment. */
export function estaConvertido(pago: Pago): boolean {
  return pago.usdtConvertido !== null;
}

/**
 * What this payment contributes to a balance: the USDT actually obtained,
 * and nothing at all until the conversion is recorded.
 *
 * Every income total in the app goes through this — the Pagos card, the
 * Dashboard tiles and chart, and Balance. Never sum `pago.monto` for a
 * balance again: that is the nominal figure the tenant paid, which the mall
 * has not necessarily realised yet.
 */
export function montoRealizado(pago: Pago): number {
  return pago.usdtConvertido ?? 0;
}

/**
 * The nominal figure still waiting to be converted; 0 once it has been.
 * Feeds the "Sin convertir" card, which is a queue of pending work, not
 * income — it is deliberately never added to a balance.
 */
export function montoSinConvertir(pago: Pago): number {
  return pago.usdtConvertido === null ? pago.monto : 0;
}
