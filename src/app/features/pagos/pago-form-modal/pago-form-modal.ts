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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Empresa } from '../../../core/models/empresa.model';
import { Local } from '../../../core/models/local.model';
import {
  CONCEPTO_LABEL,
  Pago,
  PagoConcepto,
  TipoTasa,
  esConceptoPorLocal,
} from '../../../core/models/pago.model';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';

export interface PagoFormPayload {
  concepto: PagoConcepto;
  empresaId: string;
  localId: string | null;
  fecha: string;
  monto: number;
  montoBs: number | null;
  tipoTasa: TipoTasa;
  descripcion: string | null;
  comprobanteFile: File | null;
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
  imports: [ReactiveFormsModule, SelectOnFocusDirective, PositiveDecimalDirective],
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

  protected comprobanteFile: File | null = null;

  protected get comprobanteDisplayName(): string | null {
    return this.comprobanteFile?.name ?? this.pago?.comprobanteNombre ?? null;
  }

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

  ngOnInit(): void {
    this.form.controls.concepto.setValue(this.conceptosPermitidos[0]);
    this.concepto.set(this.conceptosPermitidos[0]);

    if (this.pago) {
      this.form.patchValue({
        concepto: this.pago.concepto,
        empresaId: this.pago.empresaId,
        localId: this.pago.localId ?? '',
        fecha: this.pago.fecha,
        monto: this.pago.monto,
        montoBs: this.pago.montoBs ?? 0,
        tipoTasa: this.pago.tipoTasa,
        descripcion: this.pago.descripcion ?? '',
      });
      this.concepto.set(this.pago.concepto);
      this.empresaId.set(this.pago.empresaId);
    }

    this.syncLocalValidator();
  }

  protected onConceptoChange(value: string): void {
    this.concepto.set(value as PagoConcepto);
    this.syncLocalValidator();
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

  protected onComprobanteSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.comprobanteFile = input.files?.[0] ?? null;
  }

  protected removeComprobante(): void {
    this.comprobanteFile = null;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saved.emit({
      concepto: value.concepto,
      empresaId: value.empresaId,
      localId: value.localId || null,
      fecha: value.fecha,
      monto: value.monto,
      // Optional: a payment made in cash dollars has no bolívar side.
      montoBs: value.montoBs || null,
      tipoTasa: value.tipoTasa,
      descripcion: value.descripcion || null,
      comprobanteFile: this.comprobanteFile,
    });
  }
}
