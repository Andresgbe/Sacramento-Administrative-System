import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

const COLLAPSED_STORAGE_KEY = 'sidebar-collapsed';

interface NavItem {
  label: string;
  icon:
    | 'dashboard'
    | 'store'
    | 'receipt'
    | 'expenses'
    | 'wallet'
    | 'calculator'
    | 'reports'
    | 'services'
    | 'users';
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
    { label: 'Reporte de pagos', icon: 'receipt', route: '/pagos' },
    { label: 'Servicios', icon: 'services', route: '/servicios-basicos' },
    { label: 'Reporte de egresos', icon: 'expenses', route: '/egresos' },
    { label: 'Balance', icon: 'wallet', route: '/balance' },
    { label: 'Calculadora', icon: 'calculator', route: '/calculadora' },
    { label: 'Reportes', icon: 'reports', route: '/reportes' },
  ];

  protected readonly navItems = computed<NavItem[]>(() =>
    this.authService.isAdmin()
      ? [...this.baseNavItems, { label: 'Usuarios', icon: 'users', route: '/usuarios' }]
      : this.baseNavItems,
  );
}
