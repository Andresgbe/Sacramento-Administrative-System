import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DocumentoTipo } from '../../../core/models/documento.model';
import { Empresa, EmpresaEstado } from '../../../core/models/empresa.model';

export interface EmpresaFormPayload {
  nombreComercial: string;
  rif: string | null;
  estado: EmpresaEstado;
  imageFile: File | null;
  documentos: { tipo: DocumentoTipo; file: File }[];
}

@Component({
  selector: 'app-empresa-form-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './empresa-form-modal.html',
  styleUrl: './empresa-form-modal.scss',
})
export class EmpresaFormModal implements OnInit, OnDestroy {
  @Input() empresa: Empresa | null = null;
  @Input() saving = false;
  @Input() errorMessage: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<EmpresaFormPayload>();

  private readonly fb = inject(FormBuilder);

  protected imageFile: File | null = null;
  protected imagePreviewUrl: string | null = null;

  protected readonly showAdvanced = signal(false);
  protected contratoFile: File | null = null;
  protected rifFile: File | null = null;
  protected otroFile: File | null = null;

  private mouseDownOnBackdrop = false;

  protected readonly form = this.fb.nonNullable.group({
    nombreComercial: ['', Validators.required],
    rif: [''],
    estado: ['activo' as EmpresaEstado, Validators.required],
  });

  ngOnInit(): void {
    if (!this.empresa) {
      return;
    }

    this.form.patchValue({
      nombreComercial: this.empresa.nombreComercial,
      rif: this.empresa.rif ?? '',
      estado: this.empresa.estado,
    });
    this.imagePreviewUrl = this.empresa.imagenUrl;
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

  protected toggleAdvanced(): void {
    this.showAdvanced.update((show) => !show);
  }

  protected onFileSelected(event: Event): void {
    this.setImageFile(this.fileFromEvent(event));
  }

  protected removeImage(): void {
    this.setImageFile(null);
  }

  private setImageFile(file: File | null): void {
    if (this.imageFile && this.imagePreviewUrl) {
      URL.revokeObjectURL(this.imagePreviewUrl);
    }
    this.imageFile = file;
    this.imagePreviewUrl = file ? URL.createObjectURL(file) : (this.empresa?.imagenUrl ?? null);
  }

  protected onContratoSelected(event: Event): void {
    this.contratoFile = this.fileFromEvent(event);
  }

  protected onRifSelected(event: Event): void {
    this.rifFile = this.fileFromEvent(event);
  }

  protected onOtroSelected(event: Event): void {
    this.otroFile = this.fileFromEvent(event);
  }

  protected removeContrato(): void {
    this.contratoFile = null;
  }

  protected removeRif(): void {
    this.rifFile = null;
  }

  protected removeOtro(): void {
    this.otroFile = null;
  }

  private fileFromEvent(event: Event): File | null {
    const input = event.target as HTMLInputElement;
    return input.files?.[0] ?? null;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const documentos: { tipo: DocumentoTipo; file: File }[] = [];
    if (this.contratoFile) {
      documentos.push({ tipo: 'contrato', file: this.contratoFile });
    }
    if (this.rifFile) {
      documentos.push({ tipo: 'rif', file: this.rifFile });
    }
    if (this.otroFile) {
      documentos.push({ tipo: 'otro', file: this.otroFile });
    }

    const value = this.form.getRawValue();
    this.saved.emit({
      nombreComercial: value.nombreComercial,
      rif: value.rif || null,
      estado: value.estado,
      imageFile: this.imageFile,
      documentos,
    });
  }

  ngOnDestroy(): void {
    if (this.imageFile && this.imagePreviewUrl) {
      URL.revokeObjectURL(this.imagePreviewUrl);
    }
  }
}
