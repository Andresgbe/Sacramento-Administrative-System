import { ServicioConcepto } from './factura-servicio.model';

/**
 * What the mall pays the provider for a shared service.
 *
 * Bolívares are authoritative here — the opposite of `Egreso`, where USD is.
 * `montoUsd` and `tasa` are filled only when the figure was typed in dollars,
 * and record the rate it was converted at so a past entry never moves.
 */
export interface EgresoServicio {
  id: string;
  numero: number;
  concepto: ServicioConcepto;
  fecha: string;
  montoBs: number;
  montoUsd: number | null;
  tasa: number | null;
  descripcion: string | null;
  createdAt: string;
}
