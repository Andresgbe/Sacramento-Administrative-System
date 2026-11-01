import { EmpresaEstado } from './empresa.model';

/** Rent status for the current month. `parcial` covers the real case of a
 *  tenant who paid part of the canon — neither up to date nor simply owing. */
export type PagoStatus = 'al-dia' | 'parcial' | 'debe';

/** One past month whose canon was not paid in full. `periodo` is 'YYYY-MM'. */
export interface DeudaCanonMes {
  periodo: string;
  faltante: number;
}

/** One file attached to a local, in the private `documentos` bucket. */
export interface LocalDocumento {
  id: string;
  ruta: string;
  nombre: string;
}

export interface Local {
  id: string;
  empresaId: string;
  numeroLocal: string;
  piso: string | null;
  areaM2: number | null;
  montoAlquiler: number | null;
  /** The admin's free-text notes: contract expiry, an agreed rent increase. */
  notas: string | null;
  createdAt: string;
  // Resolved from the empresa join — the card and detail header show the
  // business identity, which no longer lives on the local itself.
  empresaNombre: string;
  empresaImagenUrl: string | null;
  empresaEstado: EmpresaEstado;
}
