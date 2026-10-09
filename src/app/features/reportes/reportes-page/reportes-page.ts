import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoriaEgreso } from '../../../core/models/egreso.model';
import { CONCEPTO_LABEL, PagoConcepto, montoRealizado } from '../../../core/models/pago.model';
import {
  MultiSelect,
  MultiSelectOption,
} from '../../../shared/components/multi-select/multi-select';
import {
  PeriodFilter,
  availableYears,
  matchesPeriod,
} from '../../../shared/components/period-filter/period-filter';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';
import { ToastService } from '../../../shared/services/toast.service';
import { EgresosService } from '../../egresos/egresos.service';
import { EmpresasService } from '../../locales/empresas.service';
import { PagosService } from '../../pagos/pagos.service';
import { TasasCambioService } from '../../tasas-cambio/tasas-cambio.service';

/** One row of the report: a pago or an egreso flattened into a common shape. */
interface Transaccion {
  id: string;
  fecha: string;
  tipo: 'ingreso' | 'egreso';
  /** Filter key: a `PagoConcepto` for pagos, `egreso-<categoria>` for egresos. */
  clave: string;
  conceptoLabel: string;
  empresa: string;
  local: string;
  descripcion: string;
  montoUsd: number;
  /** Real figure when one was recorded; null when only the USD side exists. */
  montoBs: number | null;
  /** True when `montoBs` is a live BCV conversion rather than a recorded amount. */
  bsEstimado: boolean;
  /**
   * What the row contributes to a balance. For an income it is the USDT the
   * conversion produced, so it is 0 until one is recorded; `montoUsd` above
   * keeps the nominal figure, because the export is a register of what came
   * in, not only of what was realised. For an egreso the two are the same.
   */
  montoRealizado: number;
}

const EGRESO_LABEL: Record<CategoriaEgreso, string> = {
  administrativo: 'Gasto administrativo',
  remodelacion: 'Remodelación',
  operativo: 'Gasto operativo',
};

@Component({
  selector: 'app-reportes-page',
  imports: [
    DecimalPipe,
    DatePipe,
    FormsModule,
    PeriodFilter,
    MultiSelect,
    SelectOnFocusDirective,
    PositiveDecimalDirective,
  ],
  templateUrl: './reportes-page.html',
  styleUrl: './reportes-page.scss',
})
export class ReportesPage implements OnInit {
  private readonly pagosService = inject(PagosService);
  private readonly egresosService = inject(EgresosService);
  private readonly empresasService = inject(EmpresasService);
  private readonly tasasCambioService = inject(TasasCambioService);
  private readonly toastService = inject(ToastService);

  protected readonly isLoading = computed(
    () => this.pagosService.isLoading() || this.egresosService.isLoading(),
  );

  private readonly bcvRate = computed(() => this.tasasCambioService.current()?.bcv ?? null);

  protected readonly searchInput = signal('');
  protected readonly appliedSearch = signal('');
  // Empty by default: a report page should open showing everything on record,
  // not silently scoped to the current month.
  protected readonly anio = signal('');
  protected readonly mes = signal('');
  protected readonly montoMin = signal<number | null>(null);
  protected readonly montoMax = signal<number | null>(null);
  protected readonly selectedTipos = signal<Set<string>>(new Set());
  protected readonly selectedEmpresaIds = signal<Set<string>>(new Set());

  protected readonly tipoOptions: MultiSelectOption[] = [
    ...(Object.keys(CONCEPTO_LABEL) as PagoConcepto[]).map((concepto) => ({
      id: concepto,
      label: CONCEPTO_LABEL[concepto],
    })),
    { id: 'egreso-administrativo', label: EGRESO_LABEL.administrativo },
    { id: 'egreso-operativo', label: EGRESO_LABEL.operativo },
    { id: 'egreso-remodelacion', label: EGRESO_LABEL.remodelacion },
  ];

  protected readonly empresaOptions = computed<MultiSelectOption[]>(() =>
    this.empresasService.all().map((empresa) => ({
      id: empresa.id,
      label: empresa.nombreComercial,
    })),
  );

  /** Every pago and egreso flattened into one list, newest first. */
  private readonly transacciones = computed<Transaccion[]>(() => {
    const rate = this.bcvRate();

    const pagos: Transaccion[] = this.pagosService.all().map((pago) => ({
      id: `pago-${pago.id}`,
      fecha: pago.fecha,
      tipo: 'ingreso' as const,
      clave: pago.concepto,
      conceptoLabel: CONCEPTO_LABEL[pago.concepto],
      empresa: pago.empresaNombre,
      local: pago.localNumero ?? '',
      descripcion: pago.descripcion ?? '',
      montoUsd: pago.monto,
      montoBs: pago.montoBs,
      bsEstimado: false,
      montoRealizado: montoRealizado(pago),
    }));

    const egresos: Transaccion[] = this.egresosService.all().map((egreso) => ({
      id: `egreso-${egreso.id}`,
      fecha: egreso.fecha,
      tipo: 'egreso' as const,
      clave: `egreso-${egreso.categoria}`,
      conceptoLabel: EGRESO_LABEL[egreso.categoria],
      empresa: '',
      local: '',
      descripcion: egreso.descripcion ?? '',
      montoUsd: egreso.monto,
      // Egresos carry no recorded bolívar figure, so this is a live BCV
      // conversion — flagged so the table and the export can say so.
      montoBs: rate ? egreso.monto * rate : null,
      montoRealizado: egreso.monto,
      bsEstimado: true,
    }));

    return [...pagos, ...egresos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  });

  protected readonly aniosDisponibles = computed(() =>
    availableYears(this.transacciones().map((transaccion) => transaccion.fecha)),
  );

  protected readonly hasActiveFilters = computed(
    () =>
      this.appliedSearch() !== '' ||
      this.anio() !== '' ||
      this.mes() !== '' ||
      this.montoMin() !== null ||
      this.montoMax() !== null ||
      this.selectedTipos().size > 0 ||
      this.selectedEmpresaIds().size > 0,
  );

  protected readonly resultados = computed(() => {
    const term = this.appliedSearch();
    const anio = this.anio();
    const mes = this.mes();
    const min = this.montoMin();
    const max = this.montoMax();
    const tipos = this.selectedTipos();
    const empresas = this.selectedEmpresaIds();

    // An empresa filter can only match pagos, so picking one necessarily drops
    // every egreso — they are not attached to a business.
    const nombresEmpresa = new Set(
      this.empresasService
        .all()
        .filter((empresa) => empresas.has(empresa.id))
        .map((empresa) => empresa.nombreComercial),
    );

    return this.transacciones().filter((transaccion) => {
      if (
        term &&
        !transaccion.empresa.toLowerCase().includes(term) &&
        !transaccion.descripcion.toLowerCase().includes(term) &&
        !transaccion.conceptoLabel.toLowerCase().includes(term)
      ) {
        return false;
      }
      if (!matchesPeriod(transaccion.fecha, anio, mes)) {
        return false;
      }
      if (min !== null && transaccion.montoUsd < min) {
        return false;
      }
      if (max !== null && transaccion.montoUsd > max) {
        return false;
      }
      if (tipos.size > 0 && !tipos.has(transaccion.clave)) {
        return false;
      }
      if (empresas.size > 0 && !nombresEmpresa.has(transaccion.empresa)) {
        return false;
      }
      return true;
    });
  });

  protected readonly totalIngresos = computed(() =>
    this.resultados()
      .filter((transaccion) => transaccion.tipo === 'ingreso')
      .reduce((sum, transaccion) => sum + transaccion.montoRealizado, 0),
  );

  protected readonly totalEgresos = computed(() =>
    this.resultados()
      .filter((transaccion) => transaccion.tipo === 'egreso')
      .reduce((sum, transaccion) => sum + transaccion.montoRealizado, 0),
  );

  protected readonly balance = computed(() => this.totalIngresos() - this.totalEgresos());

  /**
   * Remodelación spend among the rows on screen. A subset of `totalEgresos`,
   * not a fourth side of the balance — it is shown beside it so the client
   * can see how much of the month's outflow went to works, without having to
   * switch to the Egresos tab and filter.
   */
  protected readonly totalRemodelacion = computed(() =>
    this.resultados()
      .filter((transaccion) => transaccion.clave === 'egreso-remodelacion')
      .reduce((sum, transaccion) => sum + transaccion.montoRealizado, 0),
  );

  ngOnInit(): void {
    this.pagosService.load();
    this.egresosService.load();
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

  protected setSelectedTipos(ids: Set<string>): void {
    this.selectedTipos.set(ids);
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
    this.selectedTipos.set(new Set());
    this.selectedEmpresaIds.set(new Set());
  }

  private static readonly ENCABEZADOS = [
    'Fecha',
    'Tipo',
    'Concepto',
    'Empresa',
    'Local',
    'Descripción',
    'Monto USD',
    'Monto Bs',
    'Bs estimado',
    'USDT convertido',
  ];

  protected readonly exportando = signal(false);

  /**
   * Excel export. Amounts go in as real numbers, not preformatted strings, so
   * the client can sum and pivot them in the sheet — which is the whole point
   * of shipping .xlsx rather than a CSV.
   */
  protected async descargarExcel(): Promise<void> {
    const filas = this.resultados();
    if (!this.puedeExportar(filas.length)) {
      return;
    }

    this.exportando.set(true);
    try {
      // Loaded on demand: the library is far heavier than this page, and most
      // visits never download anything.
      const XLSX = await import('xlsx');

      const datos = [
        ReportesPage.ENCABEZADOS,
        ...filas.map((t) => [
          t.fecha,
          t.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
          t.conceptoLabel,
          t.empresa,
          t.local,
          t.descripcion,
          t.montoUsd,
          t.montoBs,
          t.bsEstimado ? 'Sí' : 'No',
          t.montoRealizado,
        ]),
        [],
        ['Total ingresos (USD)', this.totalIngresos()],
        ['Total egresos (USD)', this.totalEgresos()],
        ['Balance (USD)', this.balance()],
      ];

      const hoja = XLSX.utils.aoa_to_sheet(datos);
      hoja['!cols'] = [
        { wch: 12 },
        { wch: 10 },
        { wch: 20 },
        { wch: 26 },
        { wch: 10 },
        { wch: 40 },
        { wch: 14 },
        { wch: 16 },
        { wch: 12 },
        { wch: 16 },
      ];

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Transacciones');
      XLSX.writeFile(libro, `reporte-transacciones-${this.hoyIso()}.xlsx`);
    } catch {
      this.toastService.error('No se pudo generar el archivo de Excel.');
    } finally {
      this.exportando.set(false);
    }
  }

  protected async descargarPdf(): Promise<void> {
    const filas = this.resultados();
    if (!this.puedeExportar(filas.length)) {
      return;
    }

    this.exportando.set(true);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      // Landscape: nine columns do not fit portrait without shrinking the
      // description to uselessness.
      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(16);
      doc.text('Reporte de transacciones', 14, 16);
      doc.setFontSize(10);
      doc.text(`Generado el ${this.hoyLegible()} · ${filas.length} transacciones`, 14, 23);

      autoTable(doc, {
        startY: 30,
        head: [ReportesPage.ENCABEZADOS],
        body: filas.map((t) => [
          t.fecha,
          t.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
          t.conceptoLabel,
          t.empresa || '—',
          t.local || '—',
          t.descripcion || '—',
          this.numeroLocal(t.montoUsd),
          t.montoBs === null ? '—' : this.numeroLocal(t.montoBs),
          t.bsEstimado ? 'Sí' : 'No',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [249, 115, 22] },
        columnStyles: { 6: { halign: 'right' }, 7: { halign: 'right' } },
      });

      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

      doc.setFontSize(10);
      doc.text(`Total ingresos: $ ${this.numeroLocal(this.totalIngresos())}`, 14, finalY + 10);
      doc.text(`Total egresos: $ ${this.numeroLocal(this.totalEgresos())}`, 14, finalY + 16);
      doc.text(`Balance: $ ${this.numeroLocal(this.balance())}`, 14, finalY + 22);

      doc.save(`reporte-transacciones-${this.hoyIso()}.pdf`);
    } catch {
      this.toastService.error('No se pudo generar el PDF.');
    } finally {
      this.exportando.set(false);
    }
  }

  private puedeExportar(cantidad: number): boolean {
    if (cantidad === 0) {
      this.toastService.error('No hay transacciones que coincidan con los filtros.');
      return false;
    }
    return true;
  }

  /** Venezuelan formatting, matching what the tables on screen show. */
  private numeroLocal(value: number): string {
    return value.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private hoyIso(): string {
    const now = new Date();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const dia = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${mes}-${dia}`;
  }

  private hoyLegible(): string {
    return new Date().toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
