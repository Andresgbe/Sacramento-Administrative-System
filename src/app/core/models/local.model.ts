import { EmpresaEstado } from './empresa.model';

/** Rent status for the current month. `parcial` covers the real case of a
 *  tenant who paid part of the canon — neither up to date nor simply owing. */
export type PagoStatus = 'al-dia' | 'parcial' | 'debe';

export interface Local {
  id: string;
  empresaId: string;
  numeroLocal: string;
  piso: string | null;
  areaM2: number | null;
  montoAlquiler: number | null;
  createdAt: string;
  // Resolved from the empresa join — the card and detail header show the
  // business identity, which no longer lives on the local itself.
  empresaNombre: string;
  empresaImagenUrl: string | null;
  empresaEstado: EmpresaEstado;
}
