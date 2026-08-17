import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoriaEgreso } from '../../../core/models/egreso.model';

export interface EgresoFormPayload {
  fecha: string;
  monto: number;
  categoria: CategoriaEgreso;
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
  selector: 'app-egreso-form-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './egreso-form-modal.html',
  styleUrl: './egreso-form-modal.scss',
})
export class EgresoFormModal {
  @Input() saving = false;
  @Input() errorMessage: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<EgresoFormPayload>();

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
    fecha: [todayLocalIso(), Validators.required],
    categoria: ['administrativo' as CategoriaEgreso, Validators.required],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    descripcion: [''],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saved.emit({
      fecha: value.fecha,
      monto: value.monto,
      categoria: value.categoria,
      descripcion: value.descripcion || null,
    });
  }
}
