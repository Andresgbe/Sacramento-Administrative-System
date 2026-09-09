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

export function esConceptoPorLocal(concepto: PagoConcepto): boolean {
  return CONCEPTOS_POR_LOCAL.includes(concepto);
}

export interface Pago {
  id: string;
  numero: number;
  concepto: PagoConcepto;
  empresaId: string;
  empresaNombre: string;
  /** Only set for per-unit concepts (canon); null for empresa-wide services. */
  localId: string | null;
  localNumero: string | null;
  fecha: string;
  monto: number;
  tipoTasa: TipoTasa;
  descripcion: string | null;
  comprobanteRuta: string | null;
  comprobanteNombre: string | null;
  createdAt: string;
}
