import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CajaChicaTipo, MovimientoCajaChica } from '../../../core/models/caja-chica.model';
import {
  MovimientoFormModal,
  MovimientoFormPayload,
} from '../movimiento-form-modal/movimiento-form-modal';
import { CajaChicaService } from '../caja-chica.service';

@Component({
  selector: 'app-caja-chica-page',
  imports: [DecimalPipe, DatePipe, MovimientoFormModal],
  templateUrl: './caja-chica-page.html',
  styleUrl: './caja-chica-page.scss',
})
export class CajaChicaPage implements OnInit {
  private readonly cajaChicaService = inject(CajaChicaService);

  protected readonly movimientos = this.cajaChicaService.all;
  protected readonly balance = this.cajaChicaService.balance;
  protected readonly isLoading = this.cajaChicaService.isLoading;
  protected readonly loadError = this.cajaChicaService.loadError;

  protected readonly tipoLabel: Record<CajaChicaTipo, string> = {
    ingreso: 'Ingreso',
    retiro: 'Retiro',
  };

  protected readonly modalOpen = signal(false);
  protected readonly editingMovimiento = signal<MovimientoCajaChica | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  ngOnInit(): void {
    this.cajaChicaService.load();
  }

  protected openModal(): void {
    this.saveError.set(null);
    this.editingMovimiento.set(null);
    this.modalOpen.set(true);
  }

  protected openEditModal(movimiento: MovimientoCajaChica): void {
    this.saveError.set(null);
    this.editingMovimiento.set(movimiento);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected async onMovimientoSaved(payload: MovimientoFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const editing = this.editingMovimiento();
    const { error } = editing
      ? await this.cajaChicaService.update(editing.id, payload)
      : await this.cajaChicaService.add(payload);

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closeModal();
  }
}
