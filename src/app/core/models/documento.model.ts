export type DocumentoTipo = 'contrato' | 'rif' | 'otro';

export interface Documento {
  id: string;
  localId: string;
  tipo: DocumentoTipo;
  nombreArchivo: string;
  ruta: string;
  createdAt: string;
}
