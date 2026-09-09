import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Empresa } from '../../../core/models/empresa.model';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';

export interface LocalFormPayload {
  empresaId: string;
  numeroLocal: string;
  piso: string | null;
  montoAlquiler: number | null;
}

@Component({
  selector: 'app-local-form-modal',
  imports: [ReactiveFormsModule, SelectOnFocusDirective, PositiveDecimalDirective],
  templateUrl: './local-form-modal.html',
  styleUrl: './local-form-modal.scss',
})
export class LocalFormModal {
  @Input({ required: true }) empresas: Empresa[] = [];
  @Input() saving = false;
  @Input() errorMessage: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<LocalFormPayload>();

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
    empresaId: ['', Validators.required],
    numeroLocal: ['', Validators.required],
    piso: [''],
    montoAlquiler: [0, [Validators.min(0)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saved.emit({
      empresaId: value.empresaId,
      numeroLocal: value.numeroLocal,
      piso: value.piso || null,
      montoAlquiler: value.montoAlquiler || null,
    });
  }
}
