import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FacturaFoto,
  FacturaServicio,
  SERVICIO_CONCEPTOS,
  ServicioConcepto,
} from '../../../core/models/factura-servicio.model';
import {
  CONCEPTO_LABEL,
  Pago,
  PagoConcepto,
  esConceptoDeIngreso,
} from '../../../core/models/pago.model';
import { AuthService } from '../../../core/services/auth.service';
import { EmpresasService } from '../../locales/empresas.service';
import { LocalesService } from '../../locales/locales.service';
import { PagoFormModal, PagoFormPayload } from '../../pagos/pago-form-modal/pago-form-modal';
import { PagosService } from '../../pagos/pagos.service';
import { TasasCambioService } from '../../tasas-cambio/tasas-cambio.service';
import {
  PeriodFilter,
  availableYears,
  formatPeriodo,
  matchesPeriod,
} from '../../../shared/components/period-filter/period-filter';
import { TabItem, Tabs } from '../../../shared/components/tabs/tabs';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { ToastService } from '../../../shared/services/toast.service';
import { EgresoServicio } from '../../../core/models/egreso-servicio.model';
import {
  EgresoServicioFormModal,
  EgresoServicioFormPayload,
} from '../egreso-servicio-form-modal/egreso-servicio-form-modal';
import { EgresosServicioService } from '../egresos-servicio.service';
import { FacturaFormModal, FacturaFormPayload } from '../factura-form-modal/factura-form-modal';
import { ServiciosBasicosService } from '../servicios-basicos.service';

type FiltroServicio = ServicioConcepto | 'todos';
type ServiciosTab = 'facturas' | 'pagos' | 'egresos';

@Component({
  selector: 'app-servicios-basicos-page',
  imports: [
    DecimalPipe,
    DatePipe,
    Tabs,
    PeriodFilter,
    FacturaFormModal,
    PagoFormModal,
    EgresoServicioFormModal,
  ],
  templateUrl: './servicios-basicos-page.html',
  styleUrl: './servicios-basicos-page.scss',
})
export class ServiciosBasicosPage implements OnInit {
  private readonly service = inject(ServiciosBasicosService);
  private readonly pagosService = inject(PagosService);
  private readonly egresosServicioService = inject(EgresosServicioService);
  private readonly localesService = inject(LocalesService);
  private readonly empresasService = inject(EmpresasService);
  private readonly authService = inject(AuthService);
  private readonly tasasCambioService = inject(TasasCambioService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);

  protected readonly isAdmin = this.authService.isAdmin;

  protected readonly isLoading = this.service.isLoading;
  protected readonly loadError = this.service.loadError;

  protected readonly conceptoLabel = CONCEPTO_LABEL;

  protected readonly tab = signal<ServiciosTab>('pagos');

  protected readonly tabItems: TabItem<ServiciosTab>[] = [
    { id: 'pagos', label: 'Pagos de las empresas' },
    { id: 'egresos', label: 'Egresos de servicios' },
    { id: 'facturas', label: 'Facturas del mes' },
  ];

  /** Canon and condominio are the mall's own income and belong in Reporte de
   *  pagos; these two are collected and forwarded, so they live here. */
  protected readonly conceptosPermitidos: PagoConcepto[] = SERVICIO_CONCEPTOS;

  protected readonly servicio = signal<FiltroServicio>('todos');

  protected readonly servicioTabs: TabItem<FiltroServicio>[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'corpoelec', label: 'Corpoelec' },
    { id: 'hidrocapital', label: 'Hidrocapital' },
  ];

  // Empty by default: this page is a historical record, so it opens showing
  // every month rather than hiding everything but the current one.
  protected readonly anio = signal('');
  protected readonly mes = signal('');

  protected readonly aniosDisponibles = computed(() =>
    availableYears(this.service.all().map((factura) => factura.periodo)),
  );

  protected readonly hasActiveFilters = computed(
    () => this.anio() !== '' || this.mes() !== '' || this.servicio() !== 'todos',
  );

  protected readonly facturasFiltradas = computed(() => {
    const servicio = this.servicio();
    const anio = this.anio();
    const mes = this.mes();

    return this.service.all().filter((factura) => {
      if (servicio !== 'todos' && factura.concepto !== servicio) {
        return false;
      }
      return matchesPeriod(factura.periodo, anio, mes);
    });
  });

  // --- Pagos de servicios: the same `pagos` table, service concepts only ---

  protected readonly pagosFiltrados = computed(() => {
    const servicio = this.servicio();
    const anio = this.anio();
    const mes = this.mes();

    return this.pagosService.all().filter((pago) => {
      if (esConceptoDeIngreso(pago.concepto)) {
        return false;
      }
      if (servicio !== 'todos' && pago.concepto !== servicio) {
        return false;
      }
      return matchesPeriod(pago.fecha, anio, mes);
    });
  });

  protected readonly bcvRate = computed(() => this.tasasCambioService.current()?.bcv ?? null);

  // Services are collected in Bs, so this is the real, authoritative total —
  // same reasoning as ingresosDelMesBs on the Dashboard: rows with no montoBs
  // (paid straight in cash dollars) contribute 0, never an invented estimate.
  protected readonly totalPagosBs = computed(() =>
    this.pagosFiltrados().reduce((sum, pago) => sum + (pago.montoBs ?? 0), 0),
  );

  // Live BCV conversion for display only, always today's rate per product
  // decision — not the rate frozen on each row's `monto` at entry time.
  protected readonly totalPagosUsdEquivalente = computed(() => {
    const rate = this.bcvRate();
    return rate ? this.totalPagosBs() / rate : null;
  });

  protected montoUsdEquivalente(pago: Pago): number | null {
    const rate = this.bcvRate();
    if (!pago.montoBs || !rate) return null;
    return pago.montoBs / rate;
  }

  // --- Egresos de servicios: what the mall pays the providers ---

  protected readonly egresosFiltrados = computed(() => {
    const servicio = this.servicio();
    const anio = this.anio();
    const mes = this.mes();

    return this.egresosServicioService.all().filter((egreso) => {
      if (servicio !== 'todos' && egreso.concepto !== servicio) {
        return false;
      }
      return matchesPeriod(egreso.fecha, anio, mes);
    });
  });

  protected readonly totalEgresosBs = computed(() =>
    this.egresosFiltrados().reduce((sum, egreso) => sum + egreso.montoBs, 0),
  );

  /** What was collected minus what was paid out, in bolívares — the number
   *  that says whether the tenants' payments covered the providers' bills.
   *  Deliberately absent from Balance: services are collected and forwarded,
   *  so they belong to this page alone. */
  protected readonly saldoServiciosBs = computed(() => this.totalPagosBs() - this.totalEgresosBs());

  protected readonly egresoModalOpen = signal(false);
  protected readonly editingEgreso = signal<EgresoServicio | null>(null);
  protected readonly deletingEgresoId = signal<string | null>(null);

  protected openEgresoModal(egreso: EgresoServicio | null): void {
    this.saveError.set(null);
    this.editingEgreso.set(egreso);
    this.egresoModalOpen.set(true);
  }

  protected closeEgresoModal(): void {
    this.egresoModalOpen.set(false);
    this.editingEgreso.set(null);
  }

  protected async onEgresoSaved(payload: EgresoServicioFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const editing = this.editingEgreso();
    const { error } = editing
      ? await this.egresosServicioService.update(editing.id, payload)
      : await this.egresosServicioService.add(payload);

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closeEgresoModal();
    this.toastService.success(editing ? 'Egreso actualizado.' : 'Egreso registrado.');
  }

  protected async deleteEgreso(egreso: EgresoServicio): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar egreso',
      message: `¿Eliminar el egreso de ${CONCEPTO_LABEL[egreso.concepto]} por ${egreso.montoBs.toFixed(2)} Bs? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    this.deletingEgresoId.set(egreso.id);
    const { error } = await this.egresosServicioService.delete(egreso.id);
    this.deletingEgresoId.set(null);

    if (error) {
      this.toastService.error(error);
      return;
    }

    this.toastService.success('Egreso eliminado.');
  }

  protected readonly locales = this.localesService.all;
  protected readonly empresas = this.empresasService.all;

  protected readonly pagoModalOpen = signal(false);
  protected readonly editingPago = signal<Pago | null>(null);
  protected readonly deletingPagoId = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<FacturaServicio | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly deletingId = signal<string | null>(null);

  ngOnInit(): void {
    this.service.load();
    this.pagosService.load();
    this.egresosServicioService.load();
    this.localesService.load();
    this.empresasService.load();
    this.tasasCambioService.load();
  }

  protected setTab(tab: ServiciosTab): void {
    this.tab.set(tab);
  }

  protected openPagoModal(pago: Pago | null): void {
    this.saveError.set(null);
    this.editingPago.set(pago);
    this.pagoModalOpen.set(true);
  }

  protected closePagoModal(): void {
    this.pagoModalOpen.set(false);
    this.editingPago.set(null);
  }

  protected async onPagoSaved(payload: PagoFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const editing = this.editingPago();
    const { error } = editing
      ? await this.pagosService.update(editing.id, payload)
      : await this.pagosService.add(payload);

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closePagoModal();
    this.toastService.success(editing ? 'Pago actualizado.' : 'Pago registrado.');
  }

  protected async deletePago(pago: Pago): Promise<void> {
    const monto = pago.montoBs ? `${pago.montoBs.toFixed(2)} Bs` : `$ ${pago.monto.toFixed(2)}`;
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar pago',
      message: `¿Eliminar el pago de ${CONCEPTO_LABEL[pago.concepto]} de "${pago.empresaNombre}" por ${monto}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    this.deletingPagoId.set(pago.id);
    const { error } = await this.pagosService.delete(pago.id);
    this.deletingPagoId.set(null);

    if (error) {
      this.toastService.error(error);
      return;
    }

    this.toastService.success('Pago eliminado.');
  }

  protected periodoLabel(periodo: string): string {
    return formatPeriodo(periodo);
  }

  protected setServicio(servicio: FiltroServicio): void {
    this.servicio.set(servicio);
  }

  protected setAnio(value: string): void {
    this.anio.set(value);
  }

  protected setMes(value: string): void {
    this.mes.set(value);
  }

  protected clearAllFilters(): void {
    this.servicio.set('todos');
    this.anio.set('');
    this.mes.set('');
  }

  protected openModal(factura: FacturaServicio | null): void {
    this.saveError.set(null);
    this.editing.set(factura);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.editing.set(null);
  }

  protected async onSaved(payload: FacturaFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const { fotos, ...factura } = payload;
    const editing = this.editing();

    const { error } = editing
      ? await this.service.update(editing.id, factura, fotos)
      : await this.service.add(factura, fotos);

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closeModal();
    this.toastService.success(editing ? 'Factura actualizada.' : 'Factura registrada.');
  }

  protected async abrirFoto(foto: FacturaFoto): Promise<void> {
    const { url, error } = await this.service.getFotoUrl(foto.ruta);

    if (error || !url) {
      this.toastService.error(error ?? 'No se pudo abrir la foto.');
      return;
    }

    window.open(url, '_blank', 'noopener');
  }

  protected async deleteFoto(factura: FacturaServicio, foto: FacturaFoto): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar foto',
      message: `¿Eliminar "${foto.nombreArchivo}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    const { error } = await this.service.deleteFoto(foto.id, foto.ruta);

    if (error) {
      this.toastService.error(error);
      return;
    }

    this.toastService.success('Foto eliminada.');
  }

  protected async deleteFactura(factura: FacturaServicio): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar factura',
      message: `¿Eliminar la factura de ${CONCEPTO_LABEL[factura.concepto]} de ${this.periodoLabel(factura.periodo)}? Se borran también sus ${factura.fotos.length} foto(s). Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    this.deletingId.set(factura.id);
    const { error } = await this.service.delete(factura.id);
    this.deletingId.set(null);

    if (error) {
      this.toastService.error(error);
      return;
    }

    this.toastService.success('Factura eliminada.');
  }
}
