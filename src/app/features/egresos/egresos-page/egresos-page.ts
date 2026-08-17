import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CategoriaEgreso } from '../../../core/models/egreso.model';
import { EgresoFormModal, EgresoFormPayload } from '../egreso-form-modal/egreso-form-modal';
import { EgresosService } from '../egresos.service';

type FiltroCategoria = CategoriaEgreso | 'todos';

@Component({
  selector: 'app-egresos-page',
  imports: [DecimalPipe, DatePipe, EgresoFormModal],
  templateUrl: './egresos-page.html',
  styleUrl: './egresos-page.scss',
})
export class EgresosPage implements OnInit {
  private readonly egresosService = inject(EgresosService);

  protected readonly isLoading = this.egresosService.isLoading;
  protected readonly loadError = this.egresosService.loadError;

  protected readonly filtro = signal<FiltroCategoria>('todos');

  protected readonly categoriaLabel: Record<CategoriaEgreso, string> = {
    administrativo: 'Administrativo',
    operativo: 'Operativo',
  };

  protected readonly egresosFiltrados = computed(() => {
    const filtro = this.filtro();
    const egresos = this.egresosService.all();
    return filtro === 'todos' ? egresos : egresos.filter((egreso) => egreso.categoria === filtro);
  });

  protected readonly total = computed(() =>
    this.egresosFiltrados().reduce((sum, egreso) => sum + egreso.monto, 0),
  );

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  ngOnInit(): void {
    this.egresosService.load();
  }

  protected setFiltro(filtro: FiltroCategoria): void {
    this.filtro.set(filtro);
  }

  protected openModal(): void {
    this.saveError.set(null);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected async onEgresoSaved(payload: EgresoFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const { error } = await this.egresosService.add(payload);

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closeModal();
  }
}
