import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  icon: 'dashboard' | 'store' | 'receipt' | 'expenses' | 'wallet' | 'calculator';
  route: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Locales', icon: 'store', route: '/locales' },
    { label: 'Pagos de alquiler', icon: 'receipt', route: '/pagos' },
    { label: 'Egresos', icon: 'expenses', route: '/egresos' },
    { label: 'Caja chica', icon: 'wallet', route: '/caja-chica' },
    { label: 'Calculadora', icon: 'calculator', route: '/calculadora' },
  ];
}
