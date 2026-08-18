export type UserRol = 'admin' | 'subadmin';

export interface Usuario {
  id: string;
  email: string;
  nombreCompleto: string;
  rol: UserRol;
  createdAt: string;
}
