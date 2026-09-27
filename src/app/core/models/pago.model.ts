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
  descripcion: string | null;
  comprobanteRuta: string | null;
  comprobanteNombre: string | null;
  createdAt: string;
}
