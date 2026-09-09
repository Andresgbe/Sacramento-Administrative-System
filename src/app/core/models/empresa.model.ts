export type EmpresaEstado = 'activo' | 'inactivo' | 'vencido';

export interface Empresa {
  id: string;
  nombreComercial: string;
  rif: string | null;
  imagenUrl: string | null;
  estado: EmpresaEstado;
  /** Inmobiliaria Di Placido owns the mall: it takes a share of the service
   *  bills but is never a tenant, so it pays no canon and is not counted
   *  among the active businesses. */
  esPropietaria: boolean;
  createdAt: string;
}
