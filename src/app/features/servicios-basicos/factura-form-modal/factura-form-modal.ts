import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FacturaServicio,
  SERVICIO_CONCEPTOS,
  ServicioConcepto,
} from '../../../core/models/factura-servicio.model';
import { CONCEPTO_LABEL } from '../../../core/models/pago.model';
import { MESES } from '../../../shared/components/period-filter/period-filter';

export interface FacturaFormPayload {
  concepto: ServicioConcepto;
  periodo: string;
  fotos: File[];
}

@Component({
  selector: 'app-factura-form-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './factura-form-modal.html',
  styleUrl: './factura-form-modal.scss',
})
export class FacturaFormModal implements OnInit {
  @Input() factura: FacturaServicio | null = null;
  @Input() saving = false;
  @Input() errorMessage: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<FacturaFormPayload>();

  private readonly fb = inject(FormBuilder);

  protected readonly conceptos = SERVICIO_CONCEPTOS;
  protected readonly conceptoLabel = CONCEPTO_LABEL;
  protected readonly meses = MESES;
  protected readonly anios = Array.from({ length: 6 }, (_, i) =>
    String(new Date().getFullYear() - i),
  );

  protected readonly fotos = signal<File[]>([]);

  private mouseDownOnBackdrop = false;

  protected readonly form = this.fb.nonNullable.group({
    concepto: ['corpoelec' as ServicioConcepto, Validators.required],
    anio: [String(new Date().getFullYear()), Validators.required],
    mes: [String(new Date().getMonth() + 1).padStart(2, '0'), Validators.required],
  });

  ngOnInit(): void {
    if (!this.factura) {
      return;
    }

    const [anio, mes] = this.factura.periodo.split('-');
    this.form.patchValue({
      concepto: this.factura.concepto,
      anio,
      mes,
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

  protected onFotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fotos.update((current) => [...current, ...Array.from(input.files ?? [])]);
    // Lets the same file be picked again after being removed.
    input.value = '';
  }

  protected removeFoto(index: number): void {
    this.fotos.update((current) => current.filter((_, i) => i !== index));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saved.emit({
      concepto: value.concepto,
      periodo: `${value.anio}-${value.mes}-01`,
      fotos: this.fotos(),
    });
  }
}
