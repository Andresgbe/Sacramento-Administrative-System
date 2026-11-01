export type OperacionAuditoria = 'INSERT' | 'UPDATE' | 'DELETE';

/** One row of `auditoria`, written by the `registrar_auditoria()` trigger. */
export interface RegistroAuditoria {
  id: number;
  fecha: string;
  tabla: string;
  operacion: OperacionAuditoria;
  registroId: string | null;
  /** The row before the change; null on INSERT. A deleted row lives on here. */
  antes: Record<string, unknown> | null;
  /** The row after the change; null on DELETE. */
  despues: Record<string, unknown> | null;
  /** Null when the change came from the server (Edge Function, SQL Editor). */
  usuarioEmail: string | null;
}

export const OPERACION_LABEL: Record<OperacionAuditoria, string> = {
  INSERT: 'Creado',
  UPDATE: 'Editado',
  DELETE: 'Eliminado',
};

/** Every table the trigger is attached to, with the name the admin knows it by. */
export const TABLA_AUDITORIA_LABEL: Record<string, string> = {
  empresas: 'Empresas',
  locales: 'Locales',
  locales_documentos: 'Documentos de locales',
  pagos: 'Pagos',
  pagos_comprobantes: 'Comprobantes de pago',
  condominio_estado: 'Condominio por local',
  deudas: 'Deudas',
  facturas_servicio: 'Facturas de servicio',
  facturas_servicio_fotos: 'Fotos de facturas',
  egresos_servicio: 'Egresos de servicios',
  documentos: 'Documentos',
  egresos: 'Egresos',
  usuarios: 'Usuarios',
  modulos_config: 'Módulos',
};
