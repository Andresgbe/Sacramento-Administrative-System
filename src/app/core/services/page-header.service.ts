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
}
