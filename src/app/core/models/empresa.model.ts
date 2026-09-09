export type EmpresaEstado = 'activo' | 'inactivo' | 'vencido';

export interface Empresa {
  id: string;
  nombreComercial: string;
  rif: string | null;
  imagenUrl: string | null;
  estado: EmpresaEstado;
  createdAt: string;
}
