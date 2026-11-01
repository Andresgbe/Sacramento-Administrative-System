import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  OPERACION_LABEL,
  OperacionAuditoria,
  RegistroAuditoria,
  TABLA_AUDITORIA_LABEL,
} from '../../../core/models/auditoria.model';
import { MODULOS_CONFIGURABLES, ModuloId } from '../../../core/models/modulo.model';
import { ModulosService } from '../../../core/services/modulos.service';
import {
  PeriodFilter,
  esRangoMesActual,
  finMesActual,
  inicioMesActual,
  matchesRango,
} from '../../../shared/components/period-filter/period-filter';
import { TabItem, Tabs } from '../../../shared/components/tabs/tabs';
import { Toggle } from '../../../shared/components/toggle/toggle';
import { ToastService } from '../../../shared/services/toast.service';
import { AuditoriaService } from '../auditoria.service';

type AuditoriaTab = 'historial' | 'eliminados' | 'modulos';

interface Cambio {
  campo: string;
  antes: string;
  despues: string;
}

/** Fields that change on every write and say nothing about what was done. */
const CAMPOS_RUIDO = new Set(['updated_at', 'actualizado_en']);

/** First of these present on a row names it in the list. */
const CAMPOS_RESUMEN = [
  'nombre_comercial',
  'numero_local',
  'nombre_completo',
  'descripcion',
  'nombre',
  'modulo',
  'periodo',
  'concepto',
  'categoria',
];

@Component({
  selector: 'app-auditoria-page',
  imports: [DatePipe, LowerCasePipe, FormsModule, PeriodFilter, Tabs, Toggle],
  templateUrl: './auditoria-page.html',
  styleUrl: './auditoria-page.scss',
})
export class AuditoriaPage implements OnInit {
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly modulosService = inject(ModulosService);
  private readonly toastService = inject(ToastService);

  protected readonly tabItems: TabItem<AuditoriaTab>[] = [
    { id: 'historial', label: 'Historial de cambios' },
    { id: 'eliminados', label: 'Eliminados' },
    { id: 'modulos', label: 'Módulos' },
  ];
  protected readonly tab = signal<AuditoriaTab>('historial');

  protected readonly isLoading = this.auditoriaService.isLoading;
  protected readonly loadError = this.auditoriaService.loadError;

  protected readonly operacionLabel = OPERACION_LABEL;
  protected readonly tablaOptions = Object.entries(TABLA_AUDITORIA_LABEL)
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  protected readonly modulos = MODULOS_CONFIGURABLES;

  protected readonly searchTerm = signal('');
  protected readonly fechaInicio = signal(inicioMesActual());
  protected readonly fechaFin = signal(finMesActual());
  protected readonly tabla = signal('');
  protected readonly operacion = signal<OperacionAuditoria | ''>('');

  /** Ids of the rows whose detail is open. */
  protected readonly abiertos = signal<ReadonlySet<number>>(new Set());

  protected readonly hasActiveFilters = computed(
    () =>
      this.searchTerm().trim() !== '' ||
      !esRangoMesActual(this.fechaInicio(), this.fechaFin()) ||
      this.tabla() !== '' ||
      this.operacion() !== '',
  );

  protected readonly registrosFiltrados = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const soloEliminados = this.tab() === 'eliminados';

    return this.auditoriaService.all().filter((registro) => {
      if (soloEliminados && registro.operacion !== 'DELETE') {
        return false;
      }
      if (!soloEliminados && this.operacion() && registro.operacion !== this.operacion()) {
        return false;
      }
      if (this.tabla() && registro.tabla !== this.tabla()) {
        return false;
      }
      if (!matchesRango(fechaLocal(registro.fecha), this.fechaInicio(), this.fechaFin())) {
        return false;
      }
      if (
        term &&
        !(registro.usuarioEmail ?? '').toLowerCase().includes(term) &&
        !this.resumen(registro).toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  });

  ngOnInit(): void {
    this.auditoriaService.load();
    this.modulosService.load();
  }

  protected setTab(tab: AuditoriaTab): void {
    this.tab.set(tab);
  }

  protected clearAllFilters(): void {
    this.searchTerm.set('');
    this.fechaInicio.set(inicioMesActual());
    this.fechaFin.set(finMesActual());
    this.tabla.set('');
    this.operacion.set('');
  }

  protected tablaLabel(tabla: string): string {
    return TABLA_AUDITORIA_LABEL[tabla] ?? tabla;
  }

  /** A short name for the affected row, so the list reads without opening it. */
  protected resumen(registro: RegistroAuditoria): string {
    const fila = registro.despues ?? registro.antes ?? {};
    const campo = CAMPOS_RESUMEN.find((c) => fila[c] !== null && fila[c] !== undefined && fila[c] !== '');
    const nombre = campo ? String(fila[campo]) : (registro.registroId ?? '—');
    const monto = fila['monto'];
    return typeof monto === 'number' ? `${nombre} · ${monto.toLocaleString('es-VE')}` : nombre;
  }

  protected toggleDetalle(id: number): void {
    const next = new Set(this.abiertos());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.abiertos.set(next);
  }

  /**
   * What the entry changed. An edit lists only the fields that moved; a
   * creation or a deletion lists the whole row, which for a deletion is the
   * only copy of the data left anywhere.
   */
  protected cambios(registro: RegistroAuditoria): Cambio[] {
    const antes = registro.antes ?? {};
    const despues = registro.despues ?? {};
    const campos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];

    return campos
      .filter((campo) => !CAMPOS_RUIDO.has(campo))
      .filter(
        (campo) =>
          registro.operacion !== 'UPDATE' ||
          JSON.stringify(antes[campo]) !== JSON.stringify(despues[campo]),
      )
      .map((campo) => ({
        campo,
        antes: registro.operacion === 'INSERT' ? '' : formatValor(antes[campo]),
        despues: registro.operacion === 'DELETE' ? '' : formatValor(despues[campo]),
      }));
  }

  protected moduloHabilitado(id: ModuloId): boolean {
    return this.modulosService.habilitado(id);
  }

  protected async setModulo(id: ModuloId, habilitado: boolean): Promise<void> {
    const { error } = await this.modulosService.setHabilitado(id, habilitado);
    if (error) {
      this.toastService.error(`No se pudo actualizar el módulo: ${error}`);
    }
  }
}

/** The log stores UTC; the period filter must see the date as it was in
 *  Venezuela, or an evening change lands in the next day — or month. */
function fechaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') {
    return '—';
  }
  if (typeof valor === 'boolean') {
    return valor ? 'Sí' : 'No';
  }
  if (typeof valor === 'number') {
    return valor.toLocaleString('es-VE');
  }
  if (typeof valor === 'object') {
    return JSON.stringify(valor);
  }
  return String(valor);
}
