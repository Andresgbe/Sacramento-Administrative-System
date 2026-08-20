import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoriaEgreso, Egreso } from '../../../core/models/egreso.model';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { EgresoFormModal, EgresoFormPayload } from '../egreso-form-modal/egreso-form-modal';
import { EgresosService } from '../egresos.service';

type FiltroCategoria = CategoriaEgreso | 'todos';

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-egresos-page',
  imports: [
    DecimalPipe,
    DatePipe,
    FormsModule,
    EgresoFormModal,
    SelectOnFocusDirective,
    PositiveDecimalDirective,
  ],
  templateUrl: './egresos-page.html',
  styleUrl: './egresos-page.scss',
})
export class EgresosPage implements OnInit {
  private readonly egresosService = inject(EgresosService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly isLoading = this.egresosService.isLoading;
  protected readonly loadError = this.egresosService.loadError;

  protected readonly filtro = signal<FiltroCategoria>('todos');

  protected readonly categoriaLabel: Record<CategoriaEgreso, string> = {
    administrativo: 'Administrativo',
    operativo: 'Operativo',
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

  protected readonly egresosFiltrados = computed(() => {
    const filtro = this.filtro();
    const term = this.appliedSearch();
    const month = this.month();
    const min = this.montoMin();
    const max = this.montoMax();

    return this.egresosService.all().filter((egreso) => {
      if (filtro !== 'todos' && egreso.categoria !== filtro) {
        return false;
      }
      if (term && !(egreso.descripcion ?? '').toLowerCase().includes(term)) {
        return false;
      }
      if (month && !egreso.fecha.startsWith(month)) {
        return false;
      }
      if (min !== null && egreso.monto < min) {
        return false;
      }
      if (max !== null && egreso.monto > max) {
        return false;
      }
      return true;
    });
  });

  protected readonly total = computed(() =>
    this.egresosFiltrados().reduce((sum, egreso) => sum + egreso.monto, 0),
  );

  protected readonly modalOpen = signal(false);
  protected readonly editingEgreso = signal<Egreso | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  ngOnInit(): void {
    this.egresosService.load();
  }

  protected setFiltro(filtro: FiltroCategoria): void {
    this.filtro.set(filtro);
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
    this.editingEgreso.set(null);
    this.modalOpen.set(true);
  }

  protected openEditModal(egreso: Egreso): void {
    this.saveError.set(null);
    this.editingEgreso.set(egreso);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected async onEgresoSaved(payload: EgresoFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const editing = this.editingEgreso();
    const { error } = editing
      ? await this.egresosService.update(editing.id, payload)
      : await this.egresosService.add(payload);

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closeModal();
  }

  protected async deleteEgreso(egreso: Egreso): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar gasto',
      message: `¿Estás seguro que deseas eliminar este gasto de $ ${egreso.monto.toFixed(2)}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    const { error } = await this.egresosService.delete(egreso.id);

    if (error) {
      this.saveError.set(error);
    }
  }
}
