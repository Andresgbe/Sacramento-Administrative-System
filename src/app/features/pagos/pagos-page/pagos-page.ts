import { DecimalPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CONCEPTO_LABEL, Pago, PagoConcepto, TipoTasa } from '../../../core/models/pago.model';
import { AuthService } from '../../../core/services/auth.service';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  MultiSelect,
  MultiSelectOption,
} from '../../../shared/components/multi-select/multi-select';
import {
  PeriodFilter,
  availableYears,
  currentMonth,
  currentYear,
  matchesPeriod,
} from '../../../shared/components/period-filter/period-filter';
import { TabItem, Tabs } from '../../../shared/components/tabs/tabs';
import { EmpresasService } from '../../locales/empresas.service';
import { LocalesService } from '../../locales/locales.service';
import { ComprobantePreviewModal } from '../comprobante-preview-modal/comprobante-preview-modal';
import { PagoFormModal, PagoFormPayload } from '../pago-form-modal/pago-form-modal';
import { PagosService } from '../pagos.service';

@Component({
  selector: 'app-pagos-page',
  imports: [
    DecimalPipe,
    DatePipe,
    FormsModule,
    PagoFormModal,
    ComprobantePreviewModal,
    SelectOnFocusDirective,
    PositiveDecimalDirective,
    MultiSelect,
    PeriodFilter,
    Tabs,
  ],
  templateUrl: './pagos-page.html',
  styleUrl: './pagos-page.scss',
})
export class PagosPage implements OnInit {
  private readonly pagosService = inject(PagosService);
  private readonly localesService = inject(LocalesService);
  private readonly empresasService = inject(EmpresasService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);

  protected readonly isAdmin = this.authService.isAdmin;

  protected readonly pagos = this.pagosService.all;
  protected readonly isLoading = this.pagosService.isLoading;
  protected readonly loadError = this.pagosService.loadError;

  protected readonly locales = this.localesService.all;
  protected readonly empresas = this.empresasService.all;

  protected readonly tasaLabel: Record<TipoTasa, string> = {
    BCV: 'BCV',
    EUR: 'Euro',
    USD: 'USDT/Cash',
    otra: 'Otra',
  };

  protected readonly modalOpen = signal(false);
  protected readonly editingPago = signal<Pago | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly deletingId = signal<string | null>(null);

  protected readonly comprobanteTarget = signal<Pago | null>(null);
  protected readonly comprobanteUrl = signal<string | null>(null);
  protected readonly comprobanteLoading = signal(false);
  protected readonly comprobanteError = signal<string | null>(null);

  protected readonly conceptoLabel = CONCEPTO_LABEL;

  protected readonly concepto = signal<PagoConcepto | 'todos'>('todos');

  protected readonly conceptoTabs: TabItem<PagoConcepto | 'todos'>[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'canon', label: 'Canon' },
    { id: 'condominio', label: 'Condominio' },
    { id: 'corpoelec', label: 'Corpoelec' },
    { id: 'hidrocapital', label: 'Hidrocapital' },
  ];

  protected readonly searchInput = signal('');
  protected readonly appliedSearch = signal('');
  protected readonly anio = signal(currentYear());
  protected readonly mes = signal(currentMonth());
  protected readonly montoMin = signal<number | null>(null);
  protected readonly montoMax = signal<number | null>(null);
  protected readonly selectedLocalIds = signal<Set<string>>(new Set());
  protected readonly selectedEmpresaIds = signal<Set<string>>(new Set());

  protected readonly aniosDisponibles = computed(() =>
    availableYears(this.pagos().map((pago) => pago.fecha)),
  );

  protected readonly empresaOptions = computed<MultiSelectOption[]>(() =>
    this.empresas().map((empresa) => ({ id: empresa.id, label: empresa.nombreComercial })),
  );

  protected readonly localOptions = computed<MultiSelectOption[]>(() =>
    this.locales().map((local) => ({
      id: local.id,
      label: `${local.empresaNombre} — ${local.numeroLocal}`,
    })),
  );

  protected readonly hasActiveFilters = computed(
    () =>
      this.appliedSearch() !== '' ||
      this.anio() !== '' ||
      this.mes() !== '' ||
      this.montoMin() !== null ||
      this.montoMax() !== null ||
      this.selectedLocalIds().size > 0 ||
      this.selectedEmpresaIds().size > 0,
  );

  protected readonly pagosFiltrados = computed(() => {
    const concepto = this.concepto();
    const term = this.appliedSearch();
    const anio = this.anio();
    const mes = this.mes();
    const min = this.montoMin();
    const max = this.montoMax();
    const localIds = this.selectedLocalIds();
    const empresaIds = this.selectedEmpresaIds();

    return this.pagos().filter((pago) => {
      if (concepto !== 'todos' && pago.concepto !== concepto) {
        return false;
      }
      if (
        term &&
        !pago.empresaNombre.toLowerCase().includes(term) &&
        !(pago.descripcion ?? '').toLowerCase().includes(term)
      ) {
        return false;
      }
      if (!matchesPeriod(pago.fecha, anio, mes)) {
        return false;
      }
      if (min !== null && pago.monto < min) {
        return false;
      }
      if (max !== null && pago.monto > max) {
        return false;
      }
      if (empresaIds.size > 0 && !empresaIds.has(pago.empresaId)) {
        return false;
      }
      // Empresa-wide concepts have no local, so a local filter excludes them.
      if (localIds.size > 0 && (!pago.localId || !localIds.has(pago.localId))) {
        return false;
      }
      return true;
    });
  });

  protected readonly total = computed(() =>
    this.pagosFiltrados().reduce((sum, pago) => sum + pago.monto, 0),
  );

  protected readonly totalLabel = computed(() => {
    const concepto = this.concepto();
    return concepto === 'todos' ? 'Total cobrado' : `Total ${CONCEPTO_LABEL[concepto]}`;
  });

  protected setConcepto(concepto: PagoConcepto | 'todos'): void {
    this.concepto.set(concepto);
  }

  ngOnInit(): void {
    this.pagosService.load();
    this.localesService.load();
    this.empresasService.load();
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

  protected setSelectedLocalIds(ids: Set<string>): void {
    this.selectedLocalIds.set(ids);
  }

  protected setSelectedEmpresaIds(ids: Set<string>): void {
    this.selectedEmpresaIds.set(ids);
  }

  protected clearAllFilters(): void {
    this.searchInput.set('');
    this.appliedSearch.set('');
    this.anio.set('');
    this.mes.set('');
    this.montoMin.set(null);
    this.montoMax.set(null);
    this.selectedLocalIds.set(new Set());
    this.selectedEmpresaIds.set(new Set());
  }

  protected openModal(): void {
    this.saveError.set(null);
    this.editingPago.set(null);
    this.modalOpen.set(true);
  }

  protected openEditModal(pago: Pago): void {
    this.saveError.set(null);
    this.editingPago.set(pago);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
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

    this.closeModal();
    this.toastService.success(editing ? 'Pago actualizado.' : 'Pago registrado.');
  }

  protected async deletePago(pago: Pago): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar pago',
      message: `¿Estás seguro que deseas eliminar el pago de ${CONCEPTO_LABEL[pago.concepto]} de "${pago.empresaNombre}" por $ ${pago.monto.toFixed(2)}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    this.deletingId.set(pago.id);
    const { error } = await this.pagosService.delete(pago.id);
    this.deletingId.set(null);

    if (error) {
      this.toastService.error(error);
      return;
    }

    this.toastService.success('Pago eliminado.');
  }

  protected async openComprobante(pago: Pago): Promise<void> {
    if (!pago.comprobanteRuta) return;

    this.comprobanteTarget.set(pago);
    this.comprobanteUrl.set(null);
    this.comprobanteError.set(null);
    this.comprobanteLoading.set(true);

    const { url, error } = await this.pagosService.getComprobanteUrl(pago.comprobanteRuta);

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
}
