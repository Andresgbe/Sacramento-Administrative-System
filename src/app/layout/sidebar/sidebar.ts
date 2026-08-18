import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

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
