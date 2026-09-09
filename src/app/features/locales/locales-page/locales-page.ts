import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Empresa } from '../../../core/models/empresa.model';
import { AuthService } from '../../../core/services/auth.service';
import { TabItem, Tabs } from '../../../shared/components/tabs/tabs';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { ToastService } from '../../../shared/services/toast.service';
import { PagosService } from '../../pagos/pagos.service';
import { DocumentosService } from '../documentos.service';
import { EmpresaFormModal, EmpresaFormPayload } from '../empresa-form-modal/empresa-form-modal';
import { EmpresasService } from '../empresas.service';
import { LocalCard, PagoStatus } from '../local-card/local-card';
import { LocalFormModal, LocalFormPayload } from '../local-form-modal/local-form-modal';
import { LocalesService } from '../locales.service';

type LocalesTab = 'locales' | 'empresas';

@Component({
  selector: 'app-locales-page',
  imports: [LocalCard, LocalFormModal, EmpresaFormModal, Tabs],
  templateUrl: './locales-page.html',
  styleUrl: './locales-page.scss',
})
export class LocalesPage implements OnInit {
  private readonly localesService = inject(LocalesService);
  private readonly empresasService = inject(EmpresasService);
  private readonly documentosService = inject(DocumentosService);
  private readonly pagosService = inject(PagosService);
  private readonly authService = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);

  protected readonly isAdmin = this.authService.isAdmin;

  protected readonly locales = this.localesService.all;
  protected readonly isLoading = this.localesService.isLoading;
  protected readonly loadError = this.localesService.loadError;

  protected readonly empresas = this.empresasService.all;
  protected readonly empresasLoading = this.empresasService.isLoading;
  protected readonly empresasError = this.empresasService.loadError;

  protected readonly tab = signal<LocalesTab>('locales');

  protected readonly tabItems: TabItem<LocalesTab>[] = [
    { id: 'locales', label: 'Locales' },
    { id: 'empresas', label: 'Empresas' },
  ];

  protected readonly localModalOpen = signal(false);
  protected readonly empresaModalOpen = signal(false);
  protected readonly empresaBeingEdited = signal<Empresa | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly deletingEmpresaId = signal<string | null>(null);

  private readonly localesPorEmpresa = computed(() => {
    const counts = new Map<string, number>();
    for (const local of this.locales()) {
      counts.set(local.empresaId, (counts.get(local.empresaId) ?? 0) + 1);
    }
    return counts;
  });

  protected readonly estadoLabel = {
    activo: 'Activo',
    inactivo: 'Inactivo',
    vencido: 'Vencido',
  };

  ngOnInit(): void {
    this.localesService.load();
    this.empresasService.load();
    this.pagosService.load();
  }

  protected setTab(tab: LocalesTab): void {
    this.tab.set(tab);
  }

  protected pagoStatus(localId: string): PagoStatus {
    return this.pagosService.hasPaidThisMonth(localId) ? 'al-dia' : 'debe';
  }

  protected localesCount(empresaId: string): number {
    return this.localesPorEmpresa().get(empresaId) ?? 0;
  }

  protected openLocalModal(): void {
    this.saveError.set(null);
    this.localModalOpen.set(true);
  }

  protected closeLocalModal(): void {
    this.localModalOpen.set(false);
  }

  protected openEmpresaModal(empresa: Empresa | null): void {
    this.saveError.set(null);
    this.empresaBeingEdited.set(empresa);
    this.empresaModalOpen.set(true);
  }

  protected closeEmpresaModal(): void {
    this.empresaModalOpen.set(false);
    this.empresaBeingEdited.set(null);
  }

  protected async onLocalSaved(payload: LocalFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const { error } = await this.localesService.add({
      empresaId: payload.empresaId,
      numeroLocal: payload.numeroLocal,
      piso: payload.piso,
      areaM2: null,
      montoAlquiler: payload.montoAlquiler,
    });

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closeLocalModal();
    this.toastService.success('Local creado.');
  }

  protected async onEmpresaSaved(payload: EmpresaFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const existing = this.empresaBeingEdited();
    let imagenUrl = existing?.imagenUrl ?? null;

    if (payload.imageFile) {
      const { url, error } = await this.empresasService.uploadImage(payload.imageFile);

      if (error) {
        this.saveError.set(error);
        this.saving.set(false);
        return;
      }

      imagenUrl = url;
    }

    const changes = {
      nombreComercial: payload.nombreComercial,
      rif: payload.rif,
      imagenUrl,
      estado: payload.estado,
    };

    const empresaId = existing?.id ?? null;

    if (empresaId) {
      const { error } = await this.empresasService.update(empresaId, changes);
      if (error) {
        this.saving.set(false);
        this.saveError.set(error);
        return;
      }
    } else {
      const { empresa, error } = await this.empresasService.add(changes);
      if (error || !empresa) {
        this.saving.set(false);
        this.saveError.set(error);
        return;
      }
      await this.uploadDocumentos(empresa.id, payload.documentos);
      this.saving.set(false);
      this.closeEmpresaModal();
      // Locales carry the empresa's name/logo through a join, so the grid is
      // stale until it is refetched.
      await this.localesService.load();
      this.toastService.success('Empresa creada.');
      return;
    }

    await this.uploadDocumentos(empresaId, payload.documentos);

    this.saving.set(false);
    this.closeEmpresaModal();
    await this.localesService.load();
    this.toastService.success('Cambios guardados.');
  }

  // Documents are optional metadata — the empresa is already saved by this
  // point, so an upload failure shouldn't block or undo it.
  private async uploadDocumentos(
    empresaId: string,
    documentos: EmpresaFormPayload['documentos'],
  ): Promise<void> {
    for (const documento of documentos) {
      await this.documentosService.upload(empresaId, documento.tipo, documento.file);
    }
  }

  protected async deleteEmpresa(empresa: Empresa): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Eliminar empresa',
      message: `¿Estás seguro que deseas eliminar "${empresa.nombreComercial}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    this.deletingEmpresaId.set(empresa.id);
    const { error } = await this.empresasService.delete(empresa.id);
    this.deletingEmpresaId.set(null);

    if (error) {
      this.toastService.error(error);
      return;
    }

    this.toastService.success('Empresa eliminada.');
  }
}
