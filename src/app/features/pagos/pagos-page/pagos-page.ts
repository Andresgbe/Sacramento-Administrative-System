import { DecimalPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { TipoTasa } from '../../../core/models/pago.model';
import { LocalesService } from '../../locales/locales.service';
import { PagoFormModal, PagoFormPayload } from '../pago-form-modal/pago-form-modal';
import { PagosService } from '../pagos.service';

@Component({
  selector: 'app-pagos-page',
  imports: [DecimalPipe, DatePipe, PagoFormModal],
  templateUrl: './pagos-page.html',
  styleUrl: './pagos-page.scss',
})
export class PagosPage implements OnInit {
  private readonly pagosService = inject(PagosService);
  private readonly localesService = inject(LocalesService);

  protected readonly pagos = this.pagosService.all;
  protected readonly isLoading = this.pagosService.isLoading;
  protected readonly loadError = this.pagosService.loadError;

  protected readonly locales = this.localesService.all;

  protected readonly tasaLabel: Record<TipoTasa, string> = {
    BCV: 'BCV',
    EUR: 'Euro',
    USD: 'Dólar',
    otra: 'Otra',
  };

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  ngOnInit(): void {
    this.pagosService.load();
    this.localesService.load();
  }

  protected openModal(): void {
    this.saveError.set(null);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected async onPagoSaved(payload: PagoFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const { error } = await this.pagosService.add(payload);

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closeModal();
  }
}
