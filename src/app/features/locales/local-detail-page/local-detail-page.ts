import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Local, LocalEstado } from '../../../core/models/local.model';
import { TipoTasa } from '../../../core/models/pago.model';
import { PageHeaderService } from '../../../core/services/page-header.service';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { PagosService } from '../../pagos/pagos.service';
import { PagoStatus } from '../local-card/local-card';
import { LocalesService } from '../locales.service';

@Component({
  selector: 'app-local-detail-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DecimalPipe,
    DatePipe,
    SelectOnFocusDirective,
    PositiveDecimalDirective,
  ],
  templateUrl: './local-detail-page.html',
  styleUrl: './local-detail-page.scss',
})
export class LocalDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly localesService = inject(LocalesService);
  private readonly pagosService = inject(PagosService);
  private readonly pageHeaderService = inject(PageHeaderService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saveSuccess = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected local: Local | null = null;
  protected imageFile: File | null = null;
  protected imagePreviewUrl: string | null = null;

  protected readonly tasaLabel: Record<TipoTasa, string> = {
    BCV: 'BCV',
    EUR: 'Euro',
    USD: 'Dólar',
    otra: 'Otra',
  };

  protected readonly form = this.fb.nonNullable.group({
    numeroLocal: ['', Validators.required],
    nombreComercial: ['', Validators.required],
    piso: [''],
    rif: [''],
    montoAlquiler: [0, [Validators.min(0)]],
    estado: ['activo' as LocalEstado, Validators.required],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');

    this.pagosService.load();

    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    const { local, error } = await this.localesService.getById(id);
    this.loading.set(false);

    if (error || !local) {
      this.notFound.set(true);
      return;
    }

    this.applyLocal(local);
  }

  private applyLocal(local: Local): void {
    this.local = local;
    this.form.patchValue({
      numeroLocal: local.numeroLocal,
      nombreComercial: local.nombreComercial,
      piso: local.piso ?? '',
      rif: local.rif ?? '',
      montoAlquiler: local.montoAlquiler ?? 0,
      estado: local.estado,
    });
    this.imagePreviewUrl = local.imagenUrl;

    this.pageHeaderService.setHeader({
      title: local.nombreComercial,
      subtitle: local.numeroLocal,
    });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    this.imageFile = file;
    this.imagePreviewUrl = URL.createObjectURL(file);
  }

  protected pagoStatus(): PagoStatus {
    if (!this.local) {
      return 'debe';
    }
    return this.pagosService.hasPaidThisMonth(this.local.id) ? 'al-dia' : 'debe';
  }

  protected pagosDelLocal() {
    const localId = this.local?.id;
    if (!localId) {
      return [];
    }
    return this.pagosService.all().filter((pago) => pago.localId === localId);
  }

  protected async submit(): Promise<void> {
    if (!this.local || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    let imagenUrl = this.local.imagenUrl;

    if (this.imageFile) {
      const { url, error } = await this.localesService.uploadImage(this.imageFile);

      if (error) {
        this.saveError.set(error);
        this.saving.set(false);
        return;
      }

      imagenUrl = url;
    }

    const value = this.form.getRawValue();

    const { error } = await this.localesService.update(this.local.id, {
      numeroLocal: value.numeroLocal,
      nombreComercial: value.nombreComercial,
      imagenUrl,
      piso: value.piso || null,
      rif: value.rif || null,
      montoAlquiler: value.montoAlquiler || null,
      estado: value.estado,
    });

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.imageFile = null;
    this.applyLocal({
      ...this.local,
      numeroLocal: value.numeroLocal,
      nombreComercial: value.nombreComercial,
      imagenUrl,
      piso: value.piso || null,
      rif: value.rif || null,
      montoAlquiler: value.montoAlquiler || null,
      estado: value.estado,
    });
    this.saveSuccess.set(true);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected async deleteLocal(): Promise<void> {
    if (!this.local) {
      return;
    }

    this.closeMenu();

    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar local',
      message: `¿Estás seguro que deseas eliminar "${this.local.nombreComercial}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) {
      return;
    }

    this.deleting.set(true);
    this.deleteError.set(null);

    const { error } = await this.localesService.delete(this.local.id);

    this.deleting.set(false);

    if (error) {
      this.deleteError.set(error);
      return;
    }

    this.router.navigateByUrl('/locales');
  }
}
