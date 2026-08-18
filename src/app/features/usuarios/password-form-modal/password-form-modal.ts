import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-password-form-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './password-form-modal.html',
  styleUrl: './password-form-modal.scss',
})
export class PasswordFormModal {
  @Input({ required: true }) nombreCompleto = '';
  @Input() saving = false;
  @Input() errorMessage: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<string>();

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
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saved.emit(this.form.getRawValue().password);
  }
}
