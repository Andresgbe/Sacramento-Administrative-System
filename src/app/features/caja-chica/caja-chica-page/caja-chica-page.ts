import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CajaChicaTipo, MovimientoCajaChica } from '../../../core/models/caja-chica.model';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import {
  MovimientoFormModal,
  MovimientoFormPayload,
} from '../movimiento-form-modal/movimiento-form-modal';
import { CajaChicaService } from '../caja-chica.service';

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-caja-chica-page',
  imports: [
    DecimalPipe,
    DatePipe,
    FormsModule,
    MovimientoFormModal,
    SelectOnFocusDirective,
    PositiveDecimalDirective,
  ],
  templateUrl: './caja-chica-page.html',
  styleUrl: './caja-chica-page.scss',
})
export class CajaChicaPage implements OnInit {
  private readonly cajaChicaService = inject(CajaChicaService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly balance = this.cajaChicaService.balance;
  protected readonly isLoading = this.cajaChicaService.isLoading;
  protected readonly loadError = this.cajaChicaService.loadError;

  protected readonly tipoLabel: Record<CajaChicaTipo, string> = {
    ingreso: 'Ingreso',
    retiro: 'Retiro',
  };

  protected readonly searchInput = signal('');
  protected readonly appliedSearch = signal('');
  protected readonly month = signal(currentMonthIso());
  protected readonly montoMin = signal<number | null>(null);
  protected readonly montoMax = signal<number | null>(null);

  protected readonly hasActiveFilters = computed(
    () =>
      this.appliedSearch() !== '' ||
      this.month() !== '' ||
      this.montoMin() !== null ||
      this.montoMax() !== null,
  );

  protected readonly movimientosFiltrados = computed(() => {
    const term = this.appliedSearch();
    const month = this.month();
    const min = this.montoMin();
    const max = this.montoMax();

    return this.cajaChicaService.all().filter((movimiento) => {
      if (term && !(movimiento.descripcion ?? '').toLowerCase().includes(term)) {
        return false;
      }
      if (month && !movimiento.fecha.startsWith(month)) {
        return false;
      }
      if (min !== null && movimiento.monto < min) {
        return false;
      }
      if (max !== null && movimiento.monto > max) {
        return false;
      }
      return true;
    });
  });

  protected readonly modalOpen = signal(false);
  protected readonly editingMovimiento = signal<MovimientoCajaChica | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  ngOnInit(): void {
    this.cajaChicaService.load();
  }

  protected setSearchInput(value: string): void {
    this.searchInput.set(value);
  }

  protected applySearch(): void {
    this.appliedSearch.set(this.searchInput().trim().toLowerCase());
  }

  protected setMonth(value: string): void {
    this.month.set(value);
  }

  protected setMontoMin(value: string): void {
    this.montoMin.set(value === '' ? null : Number(value));
  }

  protected setMontoMax(value: string): void {
    this.montoMax.set(value === '' ? null : Number(value));
  }

  protected clearAllFilters(): void {
    this.searchInput.set('');
    this.appliedSearch.set('');
    this.month.set('');
    this.montoMin.set(null);
    this.montoMax.set(null);
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

  protected async deleteMovimiento(movimiento: MovimientoCajaChica): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar movimiento',
      message: `¿Estás seguro que deseas eliminar este ${this.tipoLabel[movimiento.tipo].toLowerCase()} de $ ${movimiento.monto.toFixed(2)}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    const { error } = await this.cajaChicaService.delete(movimiento.id);

    if (error) {
      this.saveError.set(error);
    }
  }
}
