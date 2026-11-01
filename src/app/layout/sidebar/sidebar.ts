import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ModulosService } from '../../core/services/modulos.service';

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
    | 'users'
    | 'audit';
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
  private readonly modulosService = inject(ModulosService);

  constructor() {
    this.modulosService.load();
  }

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
    { label: 'Reporte de egresos', icon: 'expenses', route: '/egresos' },
    { label: 'Servicios', icon: 'services', route: '/servicios-basicos' },
    { label: 'Balance', icon: 'wallet', route: '/balance' },
    { label: 'Tasas', icon: 'calculator', route: '/calculadora' },
    { label: 'Reportes', icon: 'reports', route: '/reportes' },
  ];

  // A module the admin principal switched off disappears for everyone,
  // the principal included; it is switched back on from Admin auditoría.
  protected readonly navItems = computed<NavItem[]>(() => {
    const items = this.baseNavItems.filter((item) =>
      this.modulosService.habilitado(item.route.slice(1)),
    );
    if (this.authService.isAdmin()) {
      items.push({ label: 'Usuarios', icon: 'users', route: '/usuarios' });
    }
    if (this.authService.isPrincipal()) {
      items.push({ label: 'Admin auditoría', icon: 'audit', route: '/auditoria' });
    }
    return items;
  });
}
