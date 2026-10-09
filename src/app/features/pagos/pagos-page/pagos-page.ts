import { DecimalPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CONCEPTOS_DE_INGRESO,
  CONCEPTO_LABEL,
  ComprobantePago,
  Pago,
  PagoConcepto,
  TipoTasa,
  esConceptoDeIngreso,
  montoRealizado,
  montoSinConvertir,
  requiereConversionManual,
} from '../../../core/models/pago.model';
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
  esPeriodoActual,
  currentMonth,
  currentYear,
  matchesPeriod,
} from '../../../shared/components/period-filter/period-filter';
import { EmpresasService } from '../../locales/empresas.service';
import { LocalesService } from '../../locales/locales.service';
import { TasasCambioService } from '../../tasas-cambio/tasas-cambio.service';
import { ComprobantePreviewModal } from '../../../shared/components/comprobante-preview-modal/comprobante-preview-modal';
import { PagoFormModal, PagoFormPayload } from '../pago-form-modal/pago-form-modal';
import { PagosService } from '../pagos.service';
import { TabItem, Tabs } from '../../../shared/components/tabs/tabs';
import { MontoEquivalencias } from '../../../shared/components/monto-equivalencias/monto-equivalencias';
import { ConversionModal, ConversionPayload } from '../conversion-modal/conversion-modal';

type FiltroConcepto = PagoConcepto | 'todos';

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
    MontoEquivalencias,
    ConversionModal,
  ],
  templateUrl: './pagos-page.html',
  styleUrl: './pagos-page.scss',
})
export class PagosPage implements OnInit {
  private readonly pagosService = inject(PagosService);
  private readonly localesService = inject(LocalesService);
  private readonly empresasService = inject(EmpresasService);
  // Only to populate it: <app-monto-equivalencias> reads the rates itself.
  private readonly tasasCambioService = inject(TasasCambioService);
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

  protected readonly conversionTarget = signal<Pago | null>(null);
  protected readonly savingConversion = signal(false);
  protected readonly conversionError = signal<string | null>(null);
  protected readonly anulandoId = signal<string | null>(null);

  protected readonly comprobanteTarget = signal<{ nombre: string } | null>(null);
  protected readonly comprobanteUrl = signal<string | null>(null);
  protected readonly comprobanteLoading = signal(false);
  protected readonly comprobanteError = signal<string | null>(null);

  /** The mall's own income: rent plus condominio. Corpoelec and Hidrocapital
   *  are collected and forwarded, so they stay in Servicios. */
  protected readonly conceptosPermitidos: PagoConcepto[] = [...CONCEPTOS_DE_INGRESO];

  protected readonly concepto = signal<FiltroConcepto>('todos');

  protected readonly conceptoTabs: TabItem<FiltroConcepto>[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'canon', label: 'Canon' },
    { id: 'condominio', label: 'Condominio' },
  ];

  protected readonly totalLabel = computed(() => {
    switch (this.concepto()) {
      case 'canon':
        return 'Total cobrado en alquiler';
      case 'condominio':
        return 'Total cobrado en condominio';
      default:
        return 'Total cobrado';
    }
  });

  protected setConcepto(concepto: FiltroConcepto): void {
    this.concepto.set(concepto);
  }

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
      !esPeriodoActual(this.anio(), this.mes()) ||
      this.montoMin() !== null ||
      this.montoMax() !== null ||
      this.selectedLocalIds().size > 0 ||
      this.selectedEmpresaIds().size > 0,
  );

  protected readonly pagosFiltrados = computed(() => {
    const term = this.appliedSearch();
    const anio = this.anio();
    const mes = this.mes();
    const min = this.montoMin();
    const max = this.montoMax();
    const localIds = this.selectedLocalIds();
    const empresaIds = this.selectedEmpresaIds();

    return this.pagos().filter((pago) => {
      if (!esConceptoDeIngreso(pago.concepto)) {
        return false;
      }
      if (this.concepto() !== 'todos' && pago.concepto !== this.concepto()) {
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
      // Condominio belongs to no empresa, so an empresa filter excludes it.
      if (empresaIds.size > 0 && (!pago.empresaId || !empresaIds.has(pago.empresaId))) {
        return false;
      }
      // Empresa-wide concepts have no local, so a local filter excludes them.
      if (localIds.size > 0 && (!pago.localId || !localIds.has(pago.localId))) {
        return false;
      }
      return true;
    });
  });

  /**
   * Realised income: only the USDT actually bought. A payment that has come
   * in but has not been converted contributes nothing here — it sits in
   * `totalSinConvertir()` until the admin records what it bought.
   */
  protected readonly total = computed(() =>
    this.pagosFiltrados().reduce((sum, pago) => sum + montoRealizado(pago), 0),
  );

  /** Nominal value of what is still waiting to be converted. Never a balance. */
  protected readonly totalSinConvertir = computed(() =>
    this.pagosFiltrados().reduce((sum, pago) => sum + montoSinConvertir(pago), 0),
  );

  protected readonly cantidadSinConvertir = computed(
    () =>
      this.pagosFiltrados().filter(
        (pago) => requiereConversionManual(pago.concepto) && pago.usdtConvertido === null,
      ).length,
  );

  /** Condominio is valued at the parallel rate when it is entered, so it has
   *  no Convertir step. */
  protected requiereConversion(pago: Pago): boolean {
    return requiereConversionManual(pago.concepto);
  }

  /**
   * Whether the "Sin convertir" card belongs on screen at all.
   *
   * Keyed on the tab, not on the card reaching 0: on Todos and Canon an empty
   * queue is real information ("nothing pending"), and hiding it there would
   * make the card vanish the moment it did its job. On Condominio there is no
   * such thing as a pending conversion, so the card is meaningless.
   */
  protected readonly muestraSinConvertir = computed(() => {
    const concepto = this.concepto();
    return concepto === 'todos' || requiereConversionManual(concepto);
  });

  // Real sum of what was actually transferred in bolívares — not a conversion
  // of `total`, same reasoning as montoBs on the model: payments made in cash
  // dollars carry no montoBs, so this covers only the transfers that recorded one.
  protected readonly totalBs = computed(() =>
    this.pagosFiltrados().reduce((sum, pago) => sum + (pago.montoBs ?? 0), 0),
  );

  ngOnInit(): void {
    this.pagosService.load();
    this.localesService.load();
    this.empresasService.load();
    this.tasasCambioService.load();
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
    // Back to the current month, not "todos": that is the page's resting
    // state, and clearing into an all-time view silently changed what the
    // totals above were counting.
    this.anio.set(currentYear());
    this.mes.set(currentMonth());
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
      message: `¿Estás seguro que deseas eliminar el pago de ${CONCEPTO_LABEL[pago.concepto]}${pago.empresaNombre ? ` de "${pago.empresaNombre}"` : ''} por $ ${pago.monto.toFixed(2)}? Esta acción no se puede deshacer.`,
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

  protected async openComprobante(comprobante: ComprobantePago): Promise<void> {
    await this.mostrarArchivo(comprobante.nombre, comprobante.ruta);
  }

  /** Shared by the payment's own receipts and the conversion's. */
  private async mostrarArchivo(nombre: string, ruta: string): Promise<void> {
    this.comprobanteTarget.set({ nombre });
    this.comprobanteUrl.set(null);
    this.comprobanteError.set(null);
    this.comprobanteLoading.set(true);

    const { url, error } = await this.pagosService.getComprobanteUrl(ruta);

    this.comprobanteLoading.set(false);

    if (error) {
      this.comprobanteError.set(error);
      return;
    }

    this.comprobanteUrl.set(url);
  }

  protected async onComprobanteEliminado(comprobante: ComprobantePago): Promise<void> {
    const { error } = await this.pagosService.deleteComprobante(comprobante);
    if (error) {
      this.toastService.error(error);
    }
  }

  protected closeComprobante(): void {
    this.comprobanteTarget.set(null);
  }

  /** The conversion receipt is a different document from the payment's own. */
  protected async openComprobanteConversion(pago: Pago): Promise<void> {
    if (!pago.conversionComprobanteRuta) return;
    await this.mostrarArchivo(
      pago.conversionComprobanteNombre ?? 'Comprobante de conversión',
      pago.conversionComprobanteRuta,
    );
  }

  protected openConversionModal(pago: Pago): void {
    this.conversionError.set(null);
    this.conversionTarget.set(pago);
  }

  protected closeConversionModal(): void {
    this.conversionTarget.set(null);
  }

  protected async onConversionSaved(payload: ConversionPayload): Promise<void> {
    const target = this.conversionTarget();
    if (!target) return;

    this.savingConversion.set(true);
    this.conversionError.set(null);

    const { error } = await this.pagosService.registrarConversion(target.id, payload);

    this.savingConversion.set(false);

    if (error) {
      this.conversionError.set(error);
      return;
    }

    this.closeConversionModal();
    this.toastService.success('Conversión registrada.');
  }

  protected async anularConversion(pago: Pago): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Anular conversión',
      message: `Este pago volverá a contar como "sin convertir" y sus ${pago.usdtConvertido?.toFixed(2)} USDT saldrán del balance. ¿Continuar?`,
      confirmLabel: 'Anular',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    this.anulandoId.set(pago.id);
    const { error } = await this.pagosService.anularConversion(pago.id);
    this.anulandoId.set(null);

    if (error) {
      this.toastService.error(error);
      return;
    }

    this.toastService.success('Conversión anulada.');
  }
}
