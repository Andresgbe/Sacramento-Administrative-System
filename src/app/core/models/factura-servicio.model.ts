import { PagoConcepto } from './pago.model';

/** Canon is charged straight to each local, so it never arrives as a shared
 *  bill the mall has to split. */
export type ServicioConcepto = Exclude<PagoConcepto, 'canon'>;

/** Condominio is NOT here: it is the mall's own income and is registered in
 *  Reporte de pagos. These two are bills the mall collects and forwards. */
export const SERVICIO_CONCEPTOS: ServicioConcepto[] = ['corpoelec', 'hidrocapital'];

export interface FacturaFoto {
  id: string;
  ruta: string;
  nombreArchivo: string;
}

/** A month's bill for one service. Carries no amount: the figures live inside
 *  the attached documents, and the per-empresa split lands in `deudas`. */
export interface FacturaServicio {
  id: string;
  concepto: ServicioConcepto;
  /** First day of the billed month; the day itself carries no meaning. */
  periodo: string;
  fotos: FacturaFoto[];
  createdAt: string;
}
