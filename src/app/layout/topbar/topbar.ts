import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderService } from '../../core/services/page-header.service';
import {
  ChangePasswordModal,
  ChangePasswordPayload,
} from '../../features/auth/change-password-modal/change-password-modal';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-topbar',
  imports: [ChangePasswordModal],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly elementRef = inject(ElementRef);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  protected readonly pageHeader = inject(PageHeaderService);

  @Output() menuToggle = new EventEmitter<void>();

  protected readonly menuOpen = signal(false);

  protected readonly userName = computed(
    () => this.authService.currentSession()?.user.email ?? 'Usuario',
  );
  protected readonly userInitials = computed(() => this.userName().slice(0, 2).toUpperCase());

  protected readonly passwordModalOpen = signal(false);
  protected readonly passwordSaving = signal(false);
  protected readonly passwordError = signal<string | null>(null);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeMenu();
    }
  }

  protected openPasswordModal(): void {
    this.passwordError.set(null);
    this.passwordModalOpen.set(true);
    this.closeMenu();
  }

  protected closePasswordModal(): void {
    this.passwordModalOpen.set(false);
  }

  protected async onPasswordSaved(payload: ChangePasswordPayload): Promise<void> {
    this.passwordSaving.set(true);
    this.passwordError.set(null);

    const { error } = await this.authService.updateOwnPassword(
      payload.currentPassword,
      payload.newPassword,
    );

    this.passwordSaving.set(false);

    if (error) {
      this.passwordError.set(error);
      return;
    }

    this.closePasswordModal();
    this.toastService.success('Contraseña actualizada.');
  }

  protected async logOut(): Promise<void> {
    this.closeMenu();
    await this.authService.signOut();
    this.router.navigateByUrl('/login');
  }
}
