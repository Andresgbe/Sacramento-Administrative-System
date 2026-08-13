import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderService } from '../../core/services/page-header.service';

@Component({
  selector: 'app-topbar',
  imports: [],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly elementRef = inject(ElementRef);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  protected readonly pageHeader = inject(PageHeaderService);

  protected readonly menuOpen = signal(false);

  protected readonly userName = computed(
    () => this.authService.currentSession()?.user.email ?? 'Usuario',
  );
  protected readonly userInitials = computed(() => this.userName().slice(0, 2).toUpperCase());

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

  protected async logOut(): Promise<void> {
    this.closeMenu();
    await this.authService.signOut();
    this.router.navigateByUrl('/login');
  }
}
