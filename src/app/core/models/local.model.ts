export type LocalEstado = 'activo' | 'inactivo' | 'vencido';

export interface Local {
  id: string;
  numeroLocal: string;
  nombreComercial: string;
  imagenUrl: string | null;
  estado: LocalEstado;
  piso: string | null;
  areaM2: number | null;
  montoAlquiler: number | null;
  createdAt: string;
}
