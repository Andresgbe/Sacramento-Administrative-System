import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

@Component({
  selector: 'app-comprobante-preview-modal',
  imports: [],
  templateUrl: './comprobante-preview-modal.html',
  styleUrl: './comprobante-preview-modal.scss',
})
export class ComprobantePreviewModal {
  @Input() nombreArchivo = 'Comprobante';
  @Input() url: string | null = null;
  @Input() loading = false;
  @Input() errorMessage: string | null = null;

  @Output() closed = new EventEmitter<void>();

  private readonly sanitizer = inject(DomSanitizer);

  private mouseDownOnBackdrop = false;

  protected get safePdfUrl(): SafeResourceUrl | null {
    return this.url ? this.sanitizer.bypassSecurityTrustResourceUrl(this.url) : null;
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

  protected get isImage(): boolean {
    return IMAGE_EXTENSIONS.includes(this.extension);
  }

  protected get isPdf(): boolean {
    return this.extension === 'pdf';
  }

  private get extension(): string {
    return this.nombreArchivo.split('.').pop()?.toLowerCase() ?? '';
  }
}
