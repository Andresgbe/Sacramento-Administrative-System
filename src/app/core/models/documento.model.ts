export type DocumentoTipo = 'contrato' | 'rif' | 'otro';

export interface Documento {
  id: string;
  empresaId: string;
  tipo: DocumentoTipo;
  nombreArchivo: string;
  ruta: string;
  createdAt: string;
}
