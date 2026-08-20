import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

const COLLAPSED_STORAGE_KEY = 'sidebar-collapsed';

interface NavItem {
  label: string;
  icon: 'dashboard' | 'store' | 'receipt' | 'expenses' | 'wallet' | 'calculator' | 'users';
  route: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  @Input() open = false;
  @Output() closeRequested = new EventEmitter<void>();

  private readonly authService = inject(AuthService);

  protected readonly collapsed = signal(localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true');

  protected toggleCollapsed(): void {
    this.collapsed.update((collapsed) => {
      const next = !collapsed;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }

  private readonly baseNavItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Locales', icon: 'store', route: '/locales' },
    { label: 'Pagos de alquiler', icon: 'receipt', route: '/pagos' },
    { label: 'Egresos', icon: 'expenses', route: '/egresos' },
    { label: 'Caja chica', icon: 'wallet', route: '/caja-chica' },
    { label: 'Calculadora', icon: 'calculator', route: '/calculadora' },
  ];

  protected readonly navItems = computed<NavItem[]>(() =>
    this.authService.isAdmin()
      ? [...this.baseNavItems, { label: 'Usuarios', icon: 'users', route: '/usuarios' }]
      : this.baseNavItems,
  );
}
