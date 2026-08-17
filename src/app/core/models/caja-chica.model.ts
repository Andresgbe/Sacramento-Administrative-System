export type CajaChicaTipo = 'ingreso' | 'retiro';

export interface MovimientoCajaChica {
  id: string;
  fecha: string;
  tipo: CajaChicaTipo;
  monto: number;
  descripcion: string | null;
  createdAt: string;
}
