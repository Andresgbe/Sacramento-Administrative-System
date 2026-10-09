import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoriaEgreso, Egreso } from '../../../core/models/egreso.model';
import { AuthService } from '../../../core/services/auth.service';
import {
  PeriodFilter,
  availableYears,
  currentMonth,
  currentYear,
  matchesPeriod,
} from '../../../shared/components/period-filter/period-filter';
import { TabItem, Tabs } from '../../../shared/components/tabs/tabs';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { ToastService } from '../../../shared/services/toast.service';
import { TasasCambioService } from '../../tasas-cambio/tasas-cambio.service';
import { ComprobantePreviewModal } from '../../../shared/components/comprobante-preview-modal/comprobante-preview-modal';
import { MontoEquivalencias } from '../../../shared/components/monto-equivalencias/monto-equivalencias';
import { EgresoFormModal, EgresoFormPayload } from '../egreso-form-modal/egreso-form-modal';
import { EgresosService } from '../egresos.service';

type FiltroCategoria = CategoriaEgreso | 'todos';

@Component({
  selector: 'app-egresos-page',
  imports: [
    DecimalPipe,
    DatePipe,
    FormsModule,
    EgresoFormModal,
    SelectOnFocusDirective,
    PositiveDecimalDirective,
    Tabs,
    PeriodFilter,
    ComprobantePreviewModal,
    MontoEquivalencias,
  ],
  templateUrl: './egresos-page.html',
  styleUrl: './egresos-page.scss',
})
export class EgresosPage implements OnInit {
  private readonly egresosService = inject(EgresosService);
  private readonly tasasCambioService = inject(TasasCambioService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);

  protected readonly isAdmin = this.authService.isAdmin;

  protected readonly isLoading = this.egresosService.isLoading;
  protected readonly loadError = this.egresosService.loadError;

  protected readonly filtro = signal<FiltroCategoria>('todos');

  protected readonly filtroTabs: TabItem<FiltroCategoria>[] = [
    { id: 'todos', label: 'Total' },
    { id: 'administrativo', label: 'Gastos administrativos' },
    { id: 'operativo', label: 'Gastos operativos' },
    { id: 'remodelacion', label: 'Remodelación' },
  ];

  protected readonly categoriaLabel: Record<CategoriaEgreso, string> = {
    administrativo: 'Administrativo',
    operativo: 'Operativo',
    remodelacion: 'Remodelación',
  };

  /**
   * Bolívar equivalent at TODAY's USDT/Cash rate — an estimate, not a record.
   *
   * An egreso's `monto` is in USDT/Cash, so the parallel rate is what turns it
   * into bolívares; it used to convert at BCV, which understated every row.
   * Unlike `pagos`, an egreso has no `monto_bs`: nobody types what actually
   * left the account, so this is a live conversion that moves with the rate.
   * Always rendered with "≈" so it is never mistaken for a real transfer.
   */
  protected bsEquivalente(montoUsdtCash: number): number | null {
    return this.tasasCambioService.aBolivares(montoUsdtCash);
  }

  protected readonly searchInput = signal('');
  protected readonly appliedSearch = signal('');
  protected readonly anio = signal(currentYear());
  protected readonly mes = signal(currentMonth());

  protected readonly montoMin = signal<number | null>(null);
  protected readonly montoMax = signal<number | null>(null);

  protected readonly aniosDisponibles = computed(() =>
    availableYears(this.egresosService.all().map((egreso) => egreso.fecha)),
  );

  protected readonly hasActiveFilters = computed(
    () =>
      this.appliedSearch() !== '' ||
      this.anio() !== '' ||
      this.mes() !== '' ||
      this.montoMin() !== null ||
      this.montoMax() !== null,
  );

  protected readonly egresosFiltrados = computed(() => {
    const filtro = this.filtro();
    const term = this.appliedSearch();
    const anio = this.anio();
    const mes = this.mes();
    const min = this.montoMin();
    const max = this.montoMax();

    return this.egresosService.all().filter((egreso) => {
      if (filtro !== 'todos' && egreso.categoria !== filtro) {
        return false;
      }
      if (term && !(egreso.descripcion ?? '').toLowerCase().includes(term)) {
        return false;
      }
      if (!matchesPeriod(egreso.fecha, anio, mes)) {
        return false;
      }
      if (min !== null && egreso.monto < min) {
        return false;
      }
      if (max !== null && egreso.monto > max) {
        return false;
      }
      return true;
    });
  });

  protected readonly total = computed(() =>
    this.egresosFiltrados().reduce((sum, egreso) => sum + egreso.monto, 0),
  );

  protected readonly modalOpen = signal(false);
  protected readonly editingEgreso = signal<Egreso | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly deletingId = signal<string | null>(null);

  protected readonly comprobanteTarget = signal<Egreso | null>(null);
  protected readonly comprobanteUrl = signal<string | null>(null);
  protected readonly comprobanteLoading = signal(false);
  protected readonly comprobanteError = signal<string | null>(null);

  protected async openComprobante(egreso: Egreso): Promise<void> {
    if (!egreso.comprobanteRuta) return;

    this.comprobanteTarget.set(egreso);
    this.comprobanteUrl.set(null);
    this.comprobanteError.set(null);
    this.comprobanteLoading.set(true);

    const { url, error } = await this.egresosService.getComprobanteUrl(egreso.comprobanteRuta);

    this.comprobanteLoading.set(false);

    if (error) {
      this.comprobanteError.set(error);
      return;
    }

    this.comprobanteUrl.set(url);
  }

  protected closeComprobante(): void {
    this.comprobanteTarget.set(null);
  }

  ngOnInit(): void {
    this.egresosService.load();
    this.tasasCambioService.load();
  }

  protected setFiltro(filtro: FiltroCategoria): void {
    this.filtro.set(filtro);
  }

  protected setSearchInput(value: string): void {
    this.searchInput.set(value);
  }

  protected applySearch(): void {
    this.appliedSearch.set(this.searchInput().trim().toLowerCase());
  }

  protected setAnio(value: string): void {
    this.anio.set(value);
  }

  protected setMes(value: string): void {
    this.mes.set(value);
  }

  protected setMontoMin(value: string): void {
    this.montoMin.set(value === '' ? null : Number(value));
  }

  protected setMontoMax(value: string): void {
    this.montoMax.set(value === '' ? null : Number(value));
  }

  protected clearAllFilters(): void {
    this.searchInput.set('');
    this.appliedSearch.set('');
    this.anio.set('');
    this.mes.set('');
    this.montoMin.set(null);
    this.montoMax.set(null);
  }

  protected openModal(): void {
    this.saveError.set(null);
    this.editingEgreso.set(null);
    this.modalOpen.set(true);
  }

  protected openEditModal(egreso: Egreso): void {
    this.saveError.set(null);
    this.editingEgreso.set(egreso);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected async onEgresoSaved(payload: EgresoFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const editing = this.editingEgreso();
    const { error } = editing
      ? await this.egresosService.update(editing.id, payload)
      : await this.egresosService.add(payload);

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closeModal();
    this.toastService.success(editing ? 'Gasto actualizado.' : 'Gasto registrado.');
  }

  protected async deleteEgreso(egreso: Egreso): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar gasto',
      message: `¿Estás seguro que deseas eliminar este gasto de $ ${egreso.monto.toFixed(2)}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    this.deletingId.set(egreso.id);
    const { error } = await this.egresosService.delete(egreso.id);
    this.deletingId.set(null);

    if (error) {
      this.toastService.error(error);
      return;
    }

    this.toastService.success('Gasto eliminado.');
  }
}
