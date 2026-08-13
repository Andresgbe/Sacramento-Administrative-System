import { Component, OnInit, inject, signal } from '@angular/core';
import { LocalCard, PagoStatus } from '../local-card/local-card';
import { LocalFormModal, LocalFormPayload } from '../local-form-modal/local-form-modal';
import { LocalesService } from '../locales.service';
import { PagosService } from '../../pagos/pagos.service';

@Component({
  selector: 'app-locales-page',
  imports: [LocalCard, LocalFormModal],
  templateUrl: './locales-page.html',
  styleUrl: './locales-page.scss',
})
export class LocalesPage implements OnInit {
  private readonly localesService = inject(LocalesService);
  private readonly pagosService = inject(PagosService);

  protected readonly locales = this.localesService.all;
  protected readonly isLoading = this.localesService.isLoading;
  protected readonly loadError = this.localesService.loadError;

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  ngOnInit(): void {
    this.localesService.load();
    this.pagosService.load();
  }

  protected pagoStatus(localId: string): PagoStatus {
    return this.pagosService.hasPaidThisMonth(localId) ? 'al-dia' : 'debe';
  }

  protected openModal(): void {
    this.saveError.set(null);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected async onLocalSaved(payload: LocalFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    let imagenUrl: string | null = null;

    if (payload.imageFile) {
      const { url, error } = await this.localesService.uploadImage(payload.imageFile);

      if (error) {
        this.saveError.set(error);
        this.saving.set(false);
        return;
      }

      imagenUrl = url;
    }

    const { error } = await this.localesService.add({
      numeroLocal: payload.numeroLocal,
      nombreComercial: payload.nombreComercial,
      imagenUrl,
      piso: payload.piso,
      areaM2: null,
      montoAlquiler: payload.montoAlquiler,
      estado: payload.estado,
    });

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closeModal();
  }
}
