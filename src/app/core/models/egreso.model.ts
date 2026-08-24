export type CategoriaEgreso = 'administrativo' | 'operativo';

export interface Egreso {
  id: string;
  numero: number;
  fecha: string;
  monto: number;
  categoria: CategoriaEgreso;
  descripcion: string | null;
  createdAt: string;
}
