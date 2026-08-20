import { DecimalPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Pago, TipoTasa } from '../../../core/models/pago.model';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { LocalesService } from '../../locales/locales.service';
import { PagoFormModal, PagoFormPayload } from '../pago-form-modal/pago-form-modal';
import { PagosService } from '../pagos.service';

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-pagos-page',
  imports: [
    DecimalPipe,
    DatePipe,
    FormsModule,
    PagoFormModal,
    SelectOnFocusDirective,
    PositiveDecimalDirective,
  ],
  templateUrl: './pagos-page.html',
  styleUrl: './pagos-page.scss',
})
export class PagosPage implements OnInit {
  private readonly pagosService = inject(PagosService);
  private readonly localesService = inject(LocalesService);
  private readonly confirmDialog = inject(ConfirmDialogService);

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
  protected readonly editingPago = signal<Pago | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly searchInput = signal('');
  protected readonly appliedSearch = signal('');
  protected readonly month = signal(currentMonthIso());
  protected readonly montoMin = signal<number | null>(null);
  protected readonly montoMax = signal<number | null>(null);
  protected readonly selectedLocalIds = signal<Set<string>>(new Set());
  protected readonly localMenuOpen = signal(false);

  protected readonly hasActiveFilters = computed(
    () =>
      this.appliedSearch() !== '' ||
      this.month() !== '' ||
      this.montoMin() !== null ||
      this.montoMax() !== null ||
      this.selectedLocalIds().size > 0,
  );

  protected readonly localFilterLabel = computed(() => {
    const selected = this.selectedLocalIds();
    if (selected.size === 0) {
      return 'Todos los locales';
    }
    if (selected.size === 1) {
      const [id] = selected;
      return this.locales().find((local) => local.id === id)?.nombreComercial ?? '1 local';
    }
    return `${selected.size} locales seleccionados`;
  });

  protected readonly pagosFiltrados = computed(() => {
    const term = this.appliedSearch();
    const month = this.month();
    const min = this.montoMin();
    const max = this.montoMax();
    const localIds = this.selectedLocalIds();

    return this.pagos().filter((pago) => {
      if (
        term &&
        !pago.localNombre.toLowerCase().includes(term) &&
        !(pago.descripcion ?? '').toLowerCase().includes(term)
      ) {
        return false;
      }
      if (month && !pago.fecha.startsWith(month)) {
        return false;
      }
      if (min !== null && pago.monto < min) {
        return false;
      }
      if (max !== null && pago.monto > max) {
        return false;
      }
      if (localIds.size > 0 && !localIds.has(pago.localId)) {
        return false;
      }
      return true;
    });
  });

  ngOnInit(): void {
    this.pagosService.load();
    this.localesService.load();
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

  protected toggleLocalMenu(): void {
    this.localMenuOpen.update((open) => !open);
  }

  protected closeLocalMenu(): void {
    this.localMenuOpen.set(false);
  }

  protected isLocalSelected(id: string): boolean {
    return this.selectedLocalIds().has(id);
  }

  protected toggleLocalSelection(id: string): void {
    this.selectedLocalIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected clearLocalFilter(): void {
    this.selectedLocalIds.set(new Set());
  }

  protected clearAllFilters(): void {
    this.searchInput.set('');
    this.appliedSearch.set('');
    this.month.set('');
    this.montoMin.set(null);
    this.montoMax.set(null);
    this.selectedLocalIds.set(new Set());
  }

  protected openModal(): void {
    this.saveError.set(null);
    this.editingPago.set(null);
    this.modalOpen.set(true);
  }

  protected openEditModal(pago: Pago): void {
    this.saveError.set(null);
    this.editingPago.set(pago);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected async onPagoSaved(payload: PagoFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const editing = this.editingPago();
    const { error } = editing
      ? await this.pagosService.update(editing.id, payload)
      : await this.pagosService.add(payload);

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closeModal();
  }

  protected async deletePago(pago: Pago): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar pago',
      message: `¿Estás seguro que deseas eliminar el pago de "${pago.localNombre}" por $ ${pago.monto.toFixed(2)}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    const { error } = await this.pagosService.delete(pago.id);

    if (error) {
      this.saveError.set(error);
    }
  }
}
