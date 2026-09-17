import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Local, PagoStatus } from '../../../core/models/local.model';
import { TipoTasa } from '../../../core/models/pago.model';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderService } from '../../../core/services/page-header.service';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';
import { PositiveDecimalDirective } from '../../../shared/directives/positive-decimal.directive';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { ToastService } from '../../../shared/services/toast.service';
import { PagosService } from '../../pagos/pagos.service';
import { EmpresasService } from '../empresas.service';
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
  private readonly empresasService = inject(EmpresasService);
  private readonly pagosService = inject(PagosService);
  private readonly pageHeaderService = inject(PageHeaderService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);

  protected readonly isAdmin = this.authService.isAdmin;

  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly menuOpen = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly empresas = this.empresasService.all;

  protected local: Local | null = null;

  protected readonly pagoStatusLabel: Record<PagoStatus, string> = {
    'al-dia': 'Al día',
    parcial: 'Pago incompleto',
    debe: 'No ha pagado alquiler',
  };

  protected readonly tasaLabel: Record<TipoTasa, string> = {
    BCV: 'BCV',
    EUR: 'Euro',
    USD: 'USDT/Cash',
    otra: 'Otra',
  };

  protected readonly form = this.fb.nonNullable.group({
    empresaId: ['', Validators.required],
    numeroLocal: ['', Validators.required],
    piso: [''],
    montoAlquiler: [0, [Validators.min(0)]],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');

    this.pagosService.load();
    this.empresasService.load();

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

    if (!this.isAdmin()) {
      this.form.disable();
    }
  }

  private applyLocal(local: Local): void {
    this.local = local;
    this.form.patchValue({
      empresaId: local.empresaId,
      numeroLocal: local.numeroLocal,
      piso: local.piso ?? '',
      montoAlquiler: local.montoAlquiler ?? 0,
    });

    this.pageHeaderService.setHeader({
      title: `${local.empresaNombre} — ${local.numeroLocal}`,
    });
  }

  protected pagoStatus(): PagoStatus {
    if (!this.local) {
      return 'debe';
    }
    return this.pagosService.estadoPago(this.local.id, this.local.montoAlquiler);
  }

  protected faltante(): number {
    if (!this.local) {
      return 0;
    }
    return this.pagosService.faltantePorPagar(this.local.id, this.local.montoAlquiler);
  }

  protected pagado(): number {
    if (!this.local) {
      return 0;
    }
    return this.pagosService.canonPagadoEsteMes(this.local.id);
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

    const value = this.form.getRawValue();

    const { local, error } = await this.localesService.update(this.local.id, {
      empresaId: value.empresaId,
      numeroLocal: value.numeroLocal,
      piso: value.piso || null,
      montoAlquiler: value.montoAlquiler || null,
    });

    this.saving.set(false);

    if (error || !local) {
      this.saveError.set(error);
      return;
    }

    this.applyLocal(local);
    this.toastService.success('Cambios guardados.');
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
      message: `¿Estás seguro que deseas eliminar el local ${this.local.numeroLocal} de "${this.local.empresaNombre}"? Esta acción no se puede deshacer.`,
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

    this.toastService.success('Local eliminado.');
    this.router.navigateByUrl('/locales');
  }
}
