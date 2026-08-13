import { Component, EventEmitter, Input, OnDestroy, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LocalEstado } from '../../../core/models/local.model';

export interface LocalFormPayload {
  numeroLocal: string;
  nombreComercial: string;
  piso: string | null;
  montoAlquiler: number | null;
  estado: LocalEstado;
  imageFile: File | null;
}

@Component({
  selector: 'app-local-form-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './local-form-modal.html',
  styleUrl: './local-form-modal.scss',
})
export class LocalFormModal implements OnDestroy {
  @Input() saving = false;
  @Input() errorMessage: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<LocalFormPayload>();

  private readonly fb = inject(FormBuilder);

  protected imageFile: File | null = null;
  protected imagePreviewUrl: string | null = null;

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
    numeroLocal: ['', Validators.required],
    nombreComercial: ['', Validators.required],
    piso: [''],
    montoAlquiler: [0, [Validators.min(0)]],
    estado: ['activo' as LocalEstado, Validators.required],
  });

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.setImageFile(file);
  }

  protected removeImage(): void {
    this.setImageFile(null);
  }

  private setImageFile(file: File | null): void {
    if (this.imagePreviewUrl) {
      URL.revokeObjectURL(this.imagePreviewUrl);
    }
    this.imageFile = file;
    this.imagePreviewUrl = file ? URL.createObjectURL(file) : null;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saved.emit({
      numeroLocal: value.numeroLocal,
      nombreComercial: value.nombreComercial,
      piso: value.piso || null,
      montoAlquiler: value.montoAlquiler || null,
      estado: value.estado,
      imageFile: this.imageFile,
    });
  }

  ngOnDestroy(): void {
    if (this.imagePreviewUrl) {
      URL.revokeObjectURL(this.imagePreviewUrl);
    }
  }
}
