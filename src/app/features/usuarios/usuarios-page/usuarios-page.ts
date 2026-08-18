import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Usuario } from '../../../core/models/usuario.model';
import { PasswordFormModal } from '../password-form-modal/password-form-modal';
import { UsuarioFormModal, UsuarioFormPayload } from '../usuario-form-modal/usuario-form-modal';
import { UsuariosService } from '../usuarios.service';

@Component({
  selector: 'app-usuarios-page',
  imports: [DatePipe, UsuarioFormModal, PasswordFormModal],
  templateUrl: './usuarios-page.html',
  styleUrl: './usuarios-page.scss',
})
export class UsuariosPage implements OnInit {
  private readonly usuariosService = inject(UsuariosService);

  protected readonly usuarios = this.usuariosService.all;
  protected readonly isLoading = this.usuariosService.isLoading;
  protected readonly loadError = this.usuariosService.loadError;

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
  }
}
