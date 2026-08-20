export type TipoTasa = 'BCV' | 'EUR' | 'USD' | 'otra';

export interface Pago {
  id: string;
  localId: string;
  localNombre: string;
  fecha: string;
  monto: number;
  tipoTasa: TipoTasa;
  descripcion: string | null;
  createdAt: string;
}
