import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CONCEPTO_LABEL, Pago } from '../../../core/models/pago.model';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';

export interface ConversionPayload {
  usdtConvertido: number;
  fecha: string;
  comprobanteFile: File | null;
  /** The stored receipt was removed and no new one replaces it. */
  eliminarComprobante: boolean;
}

// `toISOString()` reports UTC, which can roll over to tomorrow's date for
// users in negative-offset timezones (e.g. Venezuela, UTC-4) in the evening.
function todayLocalIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Records how many USDT the mall actually bought with one payment.
 *
 * The figure is typed, never computed from a rate: the point of the whole
 * flow is that what came back from the exchange differs from the nominal
 * amount, so deriving it would defeat it.
 */
@Component({
  selector: 'app-conversion-modal',
  imports: [ReactiveFormsModule, SelectOnFocusDirective, PositiveDecimalDirective, DecimalPipe],
  templateUrl: './conversion-modal.html',
  styleUrl: './conversion-modal.scss',
})
export class ConversionModal implements OnInit {
  @Input({ required: true }) pago!: Pago;
  @Input() saving = false;
  @Input() errorMessage: string | null = null;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<ConversionPayload>();

  private readonly fb = new FormBuilder().nonNullable;

  protected readonly conceptoLabel = CONCEPTO_LABEL;
  protected readonly submitError = signal<string | null>(null);

  protected comprobanteFile: File | null = null;
  /** Set when the ✕ removes the receipt already on the row. Applied on save,
   *  not immediately: the conversion is written as one unit. */
  private comprobanteEliminado = false;

  protected readonly form = this.fb.group({
    usdtConvertido: [0, [Validators.required, Validators.min(0.01)]],
    fecha: [todayLocalIso(), Validators.required],
  });

  ngOnInit(): void {
    // Re-opening a converted payment edits it rather than starting over.
    if (this.pago.usdtConvertido !== null) {
      this.form.patchValue({
        usdtConvertido: this.pago.usdtConvertido,
        fecha: this.pago.conversionFecha ?? todayLocalIso(),
      });
    }
  }

  protected get comprobanteDisplayName(): string | null {
    if (this.comprobanteFile) {
      return this.comprobanteFile.name;
    }
    return this.comprobanteEliminado ? null : this.pago.conversionComprobanteNombre;
  }

  protected onComprobanteSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.comprobanteFile = input.files?.[0] ?? null;
    // Let the same file be picked again after being removed.
    input.value = '';
  }

  protected removeComprobante(): void {
    // Dropping a freshly picked file just falls back to whatever was stored;
    // only the second ✕ marks the stored one for removal.
    if (this.comprobanteFile) {
      this.comprobanteFile = null;
      return;
    }
    this.comprobanteEliminado = true;
  }

  protected onBackdropMouseDown(event: MouseEvent): void {
    this.backdropPressed = event.target === event.currentTarget;
  }

  // Only close on a click that both started and ended on the backdrop, so a
  // drag that happens to release outside the modal does not discard the form.
  protected onBackdropClick(event: MouseEvent): void {
    if (this.backdropPressed && event.target === event.currentTarget) {
      this.closed.emit();
    }
    this.backdropPressed = false;
  }

  private backdropPressed = false;

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitError.set('Indica cuántos USDT compraste con este pago.');
      return;
    }

    this.submitError.set(null);
    const { usdtConvertido, fecha } = this.form.getRawValue();

    this.saved.emit({
      usdtConvertido,
      fecha,
      comprobanteFile: this.comprobanteFile,
      eliminarComprobante: this.comprobanteEliminado && !this.comprobanteFile,
    });
  }
}
