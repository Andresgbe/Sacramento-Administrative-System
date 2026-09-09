import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FacturaFoto,
  FacturaServicio,
  ServicioConcepto,
} from '../../../core/models/factura-servicio.model';
import { CONCEPTO_LABEL } from '../../../core/models/pago.model';
import { AuthService } from '../../../core/services/auth.service';
import {
  PeriodFilter,
  availableYears,
  formatPeriodo,
  matchesPeriod,
} from '../../../shared/components/period-filter/period-filter';
import { TabItem, Tabs } from '../../../shared/components/tabs/tabs';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { ToastService } from '../../../shared/services/toast.service';
import { FacturaFormModal, FacturaFormPayload } from '../factura-form-modal/factura-form-modal';
import { ServiciosBasicosService } from '../servicios-basicos.service';

type FiltroServicio = ServicioConcepto | 'todos';

@Component({
  selector: 'app-servicios-basicos-page',
  imports: [Tabs, PeriodFilter, FacturaFormModal],
  templateUrl: './servicios-basicos-page.html',
  styleUrl: './servicios-basicos-page.scss',
})
export class ServiciosBasicosPage implements OnInit {
  private readonly service = inject(ServiciosBasicosService);
  private readonly authService = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);

  protected readonly isAdmin = this.authService.isAdmin;

  protected readonly isLoading = this.service.isLoading;
  protected readonly loadError = this.service.loadError;

  protected readonly conceptoLabel = CONCEPTO_LABEL;

  protected readonly servicio = signal<FiltroServicio>('todos');

  protected readonly servicioTabs: TabItem<FiltroServicio>[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'condominio', label: 'Condominio' },
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

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<FacturaServicio | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly deletingId = signal<string | null>(null);

  ngOnInit(): void {
    this.service.load();
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
