import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
  protected readonly pageHeader = inject(PageHeaderService);

  protected readonly menuOpen = signal(false);

  // Placeholder until Supabase Auth provides the signed-in user
  protected readonly userName = 'Usuario Administrador';
  protected readonly userInitials = 'UA';

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

  protected logOut(): void {
    this.closeMenu();
    this.router.navigateByUrl('/login');
  }
}
