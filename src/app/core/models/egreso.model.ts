export type CategoriaEgreso = 'administrativo' | 'operativo';

export interface Egreso {
  id: string;
  numero: number;
  fecha: string;
  monto: number;
  categoria: CategoriaEgreso;
  descripcion: string | null;
  /** Receipt in the private `documentos` bucket; opened through a signed URL. */
  comprobanteRuta: string | null;
  comprobanteNombre: string | null;
  createdAt: string;
}
