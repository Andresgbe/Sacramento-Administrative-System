import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Local } from '../../../core/models/local.model';
import { Pago, TipoTasa } from '../../../core/models/pago.model';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';

export interface PagoFormPayload {
  localId: string;
  fecha: string;
  monto: number;
  tipoTasa: TipoTasa;
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
  selector: 'app-pago-form-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './pago-form-modal.html',
  styleUrl: './pago-form-modal.scss',
})
export class PagoFormModal implements OnInit {
  @Input({ required: true }) locales: Local[] = [];
  @Input() saving = false;
  @Input() errorMessage: string | null = null;
  @Input() pago: Pago | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<PagoFormPayload>();

  private readonly fb = inject(FormBuilder);

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

  protected readonly form = this.fb.nonNullable.group({
    localId: ['', Validators.required],
    fecha: [todayLocalIso(), Validators.required],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    tipoTasa: ['BCV' as TipoTasa, Validators.required],
    descripcion: [''],
  });

  ngOnInit(): void {
    if (this.pago) {
      this.form.patchValue({
        localId: this.pago.localId,
        fecha: this.pago.fecha,
        monto: this.pago.monto,
        tipoTasa: this.pago.tipoTasa,
        descripcion: this.pago.descripcion ?? '',
      });
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saved.emit({
      localId: value.localId,
      fecha: value.fecha,
      monto: value.monto,
      tipoTasa: value.tipoTasa,
      descripcion: value.descripcion || null,
    });
  }
}
