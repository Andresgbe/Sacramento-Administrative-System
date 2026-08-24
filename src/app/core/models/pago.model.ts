export type TipoTasa = 'BCV' | 'EUR' | 'USD' | 'otra';

export interface Pago {
  id: string;
  numero: number;
  localId: string;
  localNombre: string;
  fecha: string;
  monto: number;
  tipoTasa: TipoTasa;
  descripcion: string | null;
  comprobanteRuta: string | null;
  comprobanteNombre: string | null;
  createdAt: string;
}
