import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EgresoServicio } from '../../../core/models/egreso-servicio.model';
import { SERVICIO_CONCEPTOS, ServicioConcepto } from '../../../core/models/factura-servicio.model';
import { CONCEPTO_LABEL } from '../../../core/models/pago.model';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';
import { TasasCambioService } from '../../tasas-cambio/tasas-cambio.service';

export type MonedaEgreso = 'VES' | 'USD';

export interface EgresoServicioFormPayload {
  concepto: ServicioConcepto;
  fecha: string;
  montoBs: number;
  montoUsd: number | null;
  tasa: number | null;
  descripcion: string | null;
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
  selector: 'app-egreso-servicio-form-modal',
  imports: [ReactiveFormsModule, SelectOnFocusDirective, PositiveDecimalDirective, DecimalPipe],
  templateUrl: './egreso-servicio-form-modal.html',
  styleUrl: './egreso-servicio-form-modal.scss',
})
export class EgresoServicioFormModal implements OnInit {
  @Input() egreso: EgresoServicio | null = null;
  @Input() saving = false;
  @Input() errorMessage: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<EgresoServicioFormPayload>();

  private readonly fb = inject(FormBuilder);
  private readonly tasasCambioService = inject(TasasCambioService);

  protected readonly conceptos = SERVICIO_CONCEPTOS;
  protected readonly conceptoLabel = CONCEPTO_LABEL;

  private mouseDownOnBackdrop = false;

  protected readonly form = this.fb.nonNullable.group({
    concepto: ['corpoelec' as ServicioConcepto, Validators.required],
    fecha: [todayLocalIso(), Validators.required],
    moneda: ['VES' as MonedaEgreso, Validators.required],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    descripcion: [''],
  });

  /**
   * A typed dollar figure is a USDT/Cash dollar, like every other `monto` in
   * the app, so that is the rate it converts at. It used to freeze BCV here,
   * which subtracted ~25% fewer bolívares than the money was worth.
   */
  protected readonly usdtRate = computed(() => this.tasasCambioService.usdtCash());

  private readonly monedaValue = toSignal(this.form.controls.moneda.valueChanges, {
    initialValue: this.form.controls.moneda.value,
  });

  private readonly montoValue = toSignal(this.form.controls.monto.valueChanges, {
    initialValue: this.form.controls.monto.value,
  });

  protected readonly enDolares = computed(() => this.monedaValue() === 'USD');

  /** What will actually be subtracted, previewed before saving. Bolívares are
   *  the figure of record; a dollar amount is converted at today's BCV. */
  protected readonly montoBsResultante = computed(() => {
    const monto = this.montoValue();
    if (!this.enDolares()) {
      return monto || null;
    }
    const rate = this.usdtRate();
    return rate && monto ? monto * rate : null;
  });

  ngOnInit(): void {
    if (!this.tasasCambioService.current()) {
      this.tasasCambioService.load();
    }

    if (!this.egreso) {
      return;
    }

    // Editing shows the figure in the currency it was typed in.
    this.form.patchValue({
      concepto: this.egreso.concepto,
      fecha: this.egreso.fecha,
      moneda: this.egreso.montoUsd !== null ? 'USD' : 'VES',
      monto: this.egreso.montoUsd ?? this.egreso.montoBs,
      descripcion: this.egreso.descripcion ?? '',
    });
  }

  protected onBackdropMouseDown(event: MouseEvent): void {
    this.mouseDownOnBackdrop = event.target === event.currentTarget;
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (this.mouseDownOnBackdrop && event.target === event.currentTarget) {
      this.closed.emit();
    }
    this.mouseDownOnBackdrop = false;
  }

  protected errorTasa: string | null = null;

  protected submit(): void {
    this.errorTasa = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    if (value.moneda === 'VES') {
      this.saved.emit({
        concepto: value.concepto,
        fecha: value.fecha,
        montoBs: value.monto,
        montoUsd: null,
        tasa: null,
        descripcion: value.descripcion || null,
      });
      return;
    }

    const rate = this.usdtRate();
    if (!rate) {
      this.errorTasa =
        'No se pudo obtener la tasa USDT/Cash del día. Intenta de nuevo en un momento.';
      return;
    }

    // The rate is frozen onto the row: this is an expense on record, and it
    // must not drift every time the dollar moves.
    this.saved.emit({
      concepto: value.concepto,
      fecha: value.fecha,
      montoBs: Math.round(value.monto * rate * 100) / 100,
      montoUsd: value.monto,
      tasa: rate,
      descripcion: value.descripcion || null,
    });
  }
}
