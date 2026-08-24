import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Usuario } from '../../../core/models/usuario.model';
import { AuthService } from '../../../core/services/auth.service';
import { PasswordFormModal } from '../password-form-modal/password-form-modal';
import { UsuarioFormModal, UsuarioFormPayload } from '../usuario-form-modal/usuario-form-modal';
import { UsuariosService } from '../usuarios.service';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-usuarios-page',
  imports: [DatePipe, UsuarioFormModal, PasswordFormModal],
  templateUrl: './usuarios-page.html',
  styleUrl: './usuarios-page.scss',
})
export class UsuariosPage implements OnInit {
  private readonly usuariosService = inject(UsuariosService);
  private readonly authService = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);

  protected readonly usuarios = this.usuariosService.all;
  protected readonly isLoading = this.usuariosService.isLoading;
  protected readonly loadError = this.usuariosService.loadError;

  protected readonly currentUserId = computed(
    () => this.authService.currentSession()?.user.id ?? null,
  );

  protected readonly roleChangingId = signal<string | null>(null);

  protected readonly createModalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly passwordTarget = signal<Usuario | null>(null);
  protected readonly passwordSaving = signal(false);
  protected readonly passwordError = signal<string | null>(null);

  ngOnInit(): void {
    this.usuariosService.load();
  }

  protected openCreateModal(): void {
    this.saveError.set(null);
    this.createModalOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.createModalOpen.set(false);
  }

  protected async onUsuarioSaved(payload: UsuarioFormPayload): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const { error } = await this.usuariosService.create(payload);

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closeCreateModal();
    this.toastService.success('Subadmin creado.');
  }

  protected openPasswordModal(usuario: Usuario): void {
    this.passwordError.set(null);
    this.passwordTarget.set(usuario);
  }

  protected closePasswordModal(): void {
    this.passwordTarget.set(null);
  }

  protected async onPasswordSaved(newPassword: string): Promise<void> {
    const target = this.passwordTarget();
    if (!target) return;

    this.passwordSaving.set(true);
    this.passwordError.set(null);

    const { error } = await this.usuariosService.updatePassword(target.id, newPassword);

    this.passwordSaving.set(false);

    if (error) {
      this.passwordError.set(error);
      return;
    }

    this.closePasswordModal();
    this.toastService.success('Contraseña actualizada.');
  }

  protected async onToggleRole(usuario: Usuario): Promise<void> {
    const nextRol = usuario.rol === 'admin' ? 'subadmin' : 'admin';

    const confirmed = await this.confirmDialog.confirm({
      title: nextRol === 'admin' ? 'Convertir en admin' : 'Convertir en subadmin',
      message: `¿Cambiar el rol de ${usuario.nombreCompleto} a ${nextRol === 'admin' ? 'Admin' : 'Subadmin'}?`,
      confirmLabel: 'Cambiar rol',
      danger: nextRol === 'subadmin',
    });

    if (!confirmed) return;

    this.roleChangingId.set(usuario.id);

    const { error } = await this.usuariosService.updateRole(usuario.id, nextRol);

    this.roleChangingId.set(null);

    if (error) {
      this.toastService.error(error);
      return;
    }

    this.toastService.success('Rol actualizado.');
  }
}
