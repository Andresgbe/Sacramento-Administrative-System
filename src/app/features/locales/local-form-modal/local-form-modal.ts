import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Local, LocalEstado } from '../../../core/models/local.model';

@Component({
  selector: 'app-local-form-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './local-form-modal.html',
  styleUrl: './local-form-modal.scss',
})
export class LocalFormModal {
  @Input() saving = false;
  @Input() errorMessage: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Omit<Local, 'id' | 'createdAt'>>();

  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    numeroLocal: ['', Validators.required],
    nombreComercial: ['', Validators.required],
    imagenUrl: [''],
    piso: [''],
    areaM2: [0, [Validators.min(0)]],
    montoAlquiler: [0, [Validators.min(0)]],
    estado: ['activo' as LocalEstado, Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saved.emit({
      numeroLocal: value.numeroLocal,
      nombreComercial: value.nombreComercial,
      imagenUrl: value.imagenUrl || null,
      piso: value.piso || null,
      areaM2: value.areaM2 || null,
      montoAlquiler: value.montoAlquiler || null,
      estado: value.estado,
    });
  }
}
