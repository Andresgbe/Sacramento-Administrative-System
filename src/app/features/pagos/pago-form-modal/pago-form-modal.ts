import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Empresa } from '../../../core/models/empresa.model';
import { Local } from '../../../core/models/local.model';
import {
  CONCEPTO_LABEL,
  ComprobantePago,
  Pago,
  PagoConcepto,
  TipoTasa,
  esConceptoPorLocal,
  requiereEmpresa,
} from '../../../core/models/pago.model';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';
import { TasasCambioService } from '../../tasas-cambio/tasas-cambio.service';

export interface PagoFormPayload {
  concepto: PagoConcepto;
  empresaId: string | null;
  localId: string | null;
  fecha: string;
  monto: number;
  montoBs: number | null;
  tipoTasa: TipoTasa;
  descripcion: string | null;
  comprobanteFiles: File[];
}

// `toISOString()` reports UTC, which can roll over to tomorrow's date for
// users in negative-offset timezones (e.g. Venezuela, UTC-4) in the evening.
function todayLocalIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-pago-form-modal',
  imports: [ReactiveFormsModule, SelectOnFocusDirective, PositiveDecimalDirective, DecimalPipe],
  templateUrl: './pago-form-modal.html',
  styleUrl: './pago-form-modal.scss',
})
export class PagoFormModal implements OnInit {
  @Input({ required: true }) locales: Local[] = [];
  @Input({ required: true }) empresas: Empresa[] = [];
  @Input() saving = false;
  @Input() errorMessage: string | null = null;
  @Input() pago: Pago | null = null;
  /** Which concepts this form may register. Reporte de pagos passes `['canon']`
   *  and Servicios passes the three service concepts, so the same modal serves
   *  both without either page being able to write the other's rows. */
  @Input({ required: true }) conceptosPermitidos: PagoConcepto[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<PagoFormPayload>();

  private readonly fb = inject(FormBuilder);
  private readonly tasasCambioService = inject(TasasCambioService);

  /** Files picked in this session, not yet uploaded. */
  protected comprobanteFiles: File[] = [];

  /** Already stored on the pago. Removing one deletes it immediately — there
   *  is no pending state to reconcile, and the row is already saved. */
  protected comprobantesExistentes: ComprobantePago[] = [];

  /** Emitted when an existing attachment is removed, so the page can delete
   *  it through the service; the modal owns no data access of its own. */
  @Output() comprobanteEliminado = new EventEmitter<ComprobantePago>();

  private mouseDownOnBackdrop = false;

  protected onBackdropMouseDown(event: MouseEvent): void {
    this.mouseDownOnBackdrop = event.target === event.currentTarget;
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (this.mouseDownOnBackdrop && event.target === event.currentTarget) {
      this.closed.emit();
    }
    this.mouseDownOnBackdrop = false;
  }

  protected readonly conceptoLabel = CONCEPTO_LABEL;

  protected readonly concepto = signal<PagoConcepto>('canon');
  protected readonly empresaId = signal('');

  /** Only per-unit concepts (canon) ask for a local, and only among the ones
   *  the chosen empresa actually rents. */
  protected readonly pideLocal = computed(() => esConceptoPorLocal(this.concepto()));

  /** Condominio is one lump sum for the mall, not billed to any tenant, so it
   *  asks for no empresa at all. */
  protected readonly pideEmpresa = computed(() => requiereEmpresa(this.concepto()));

  /** Condominio/Corpoelec/Hidrocapital are collected in bolívares, so those
   *  three are typed in Bs; USD is shown only as a live BCV estimate and
   *  never typed by hand (unlike canon, where USD stays authoritative). */
  protected readonly esServicio = computed(() => this.concepto() !== 'canon');

  protected readonly bcvRate = computed(() => this.tasasCambioService.current()?.bcv ?? null);

  protected readonly localesDeEmpresa = computed(() =>
    this.locales.filter((local) => local.empresaId === this.empresaId()),
  );

  /** The owning company takes a share of the service bills, but pays neither
   *  rent to itself nor condominio, so it is offered only for those two. */
  protected readonly empresasDisponibles = computed(() => {
    const concepto = this.concepto();
    if (concepto === 'corpoelec' || concepto === 'hidrocapital') {
      return this.empresas;
    }
    return this.empresas.filter((empresa) => !empresa.esPropietaria);
  });

  protected readonly form = this.fb.nonNullable.group({
    concepto: ['canon' as PagoConcepto, Validators.required],
    empresaId: ['', Validators.required],
    localId: [''],
    fecha: [todayLocalIso(), Validators.required],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    montoBs: [0],
    tipoTasa: ['BCV' as TipoTasa, Validators.required],
    descripcion: [''],
  });

  private readonly montoBsValue = toSignal(this.form.controls.montoBs.valueChanges, {
    initialValue: this.form.controls.montoBs.value,
  });

  /** Preview only — recomputed at submit() from that moment's rate, never
   *  read back from here. */
  protected readonly montoUsdEstimado = computed(() => {
    const rate = this.bcvRate();
    const bs = this.montoBsValue();
    if (!rate || !bs) return null;
    return bs / rate;
  });

  ngOnInit(): void {
    if (!this.tasasCambioService.current()) {
      this.tasasCambioService.load();
    }

    this.form.controls.concepto.setValue(this.conceptosPermitidos[0]);
    this.concepto.set(this.conceptosPermitidos[0]);

    if (this.pago) {
      this.form.patchValue({
        concepto: this.pago.concepto,
        empresaId: this.pago.empresaId ?? '',
        localId: this.pago.localId ?? '',
        fecha: this.pago.fecha,
        monto: this.pago.monto,
        montoBs: this.pago.montoBs ?? 0,
        tipoTasa: this.pago.tipoTasa,
        descripcion: this.pago.descripcion ?? '',
      });
      this.concepto.set(this.pago.concepto);
      this.empresaId.set(this.pago.empresaId ?? '');
      this.comprobantesExistentes = [...this.pago.comprobantes];
    }

    this.syncEmpresaValidator();
    this.syncLocalValidator();
    this.syncMontoValidators();
  }

  protected onConceptoChange(value: string): void {
    this.concepto.set(value as PagoConcepto);
    this.syncEmpresaValidator();
    this.syncLocalValidator();
    this.syncMontoValidators();
  }

  private syncEmpresaValidator(): void {
    const control = this.form.controls.empresaId;
    if (this.pideEmpresa()) {
      control.addValidators(Validators.required);
    } else {
      control.removeValidators(Validators.required);
      control.setValue('');
    }
    control.updateValueAndValidity();
  }

  /** Canon: USD required, Bs optional. Services: Bs required, USD computed at
   *  submit time from the day's BCV rate, so it carries no validators of its own. */
  private syncMontoValidators(): void {
    const montoControl = this.form.controls.monto;
    const montoBsControl = this.form.controls.montoBs;

    if (this.esServicio()) {
      montoControl.clearValidators();
      montoBsControl.setValidators([Validators.required, Validators.min(0.01)]);
    } else {
      montoControl.setValidators([Validators.required, Validators.min(0.01)]);
      montoBsControl.clearValidators();
    }
    montoControl.updateValueAndValidity();
    montoBsControl.updateValueAndValidity();
  }

  protected onEmpresaChange(value: string): void {
    this.empresaId.set(value);
    // The previously picked local may belong to a different empresa.
    this.form.controls.localId.setValue('');
  }

  private syncLocalValidator(): void {
    const control = this.form.controls.localId;
    if (this.pideLocal()) {
      control.addValidators(Validators.required);
    } else {
      control.removeValidators(Validators.required);
      control.setValue('');
    }
    control.updateValueAndValidity();
  }

  protected onComprobantesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Appended, not replaced: picking a second time should add to the list,
    // which is what "anexar varios" means to someone choosing one at a time.
    this.comprobanteFiles = [...this.comprobanteFiles, ...Array.from(input.files ?? [])];
    // Let the same file be picked again after being removed.
    input.value = '';
  }

  protected removeComprobanteFile(file: File): void {
    this.comprobanteFiles = this.comprobanteFiles.filter((f) => f !== file);
  }

  protected removeComprobanteExistente(comprobante: ComprobantePago): void {
    this.comprobantesExistentes = this.comprobantesExistentes.filter(
      (c) => c.id !== comprobante.id,
    );
    this.comprobanteEliminado.emit(comprobante);
  }

  protected readonly submitError = signal<string | null>(null);

  protected submit(): void {
    this.submitError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    let monto = value.monto;

    if (this.esServicio()) {
      const rate = this.bcvRate();
      if (!rate) {
        this.submitError.set(
          'No se pudo obtener la tasa BCV del día. Intenta de nuevo en un momento.',
        );
        return;
      }
      monto = Math.round((value.montoBs / rate) * 100) / 100;
    }

    this.saved.emit({
      concepto: value.concepto,
      empresaId: value.empresaId || null,
      localId: value.localId || null,
      fecha: value.fecha,
      monto,
      // Optional for canon (a payment made in cash dollars has no bolívar
      // side); required for services, enforced by syncMontoValidators.
      montoBs: value.montoBs || null,
      tipoTasa: value.tipoTasa,
      descripcion: value.descripcion || null,
      comprobanteFiles: this.comprobanteFiles,
    });
  }
}
