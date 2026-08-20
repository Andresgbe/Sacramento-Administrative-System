import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly _config = signal<ConfirmDialogConfig | null>(null);
  readonly config = this._config.asReadonly();

  private resolver: ((confirmed: boolean) => void) | null = null;

  confirm(config: ConfirmDialogConfig): Promise<boolean> {
    this._config.set(config);
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  respond(confirmed: boolean): void {
    this._config.set(null);
    this.resolver?.(confirmed);
    this.resolver = null;
  }
}
