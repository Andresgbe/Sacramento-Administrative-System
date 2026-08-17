import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export interface PageHeader {
  title: string;
  subtitle?: string;
}

@Injectable({ providedIn: 'root' })
export class PageHeaderService {
  private readonly router = inject(Router);
  private readonly rootRoute = inject(ActivatedRoute);

  private readonly header = signal<PageHeader>({ title: '' });
  readonly current = this.header.asReadonly();

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.updateHeader());

    this.updateHeader();
  }

  private updateHeader(): void {
    let route = this.rootRoute.firstChild;
    while (route?.firstChild) {
      route = route.firstChild;
    }

    const data = route?.snapshot?.data ?? {};
    this.header.set({
      title: data['title'] ?? '',
      subtitle: data['subtitle'],
    });
  }

  // Lets a page override the header with dynamic content (e.g. a business name)
  // once it's loaded; the next navigation resets it from route data as usual.
  setHeader(header: PageHeader): void {
    this.header.set(header);
  }
}
