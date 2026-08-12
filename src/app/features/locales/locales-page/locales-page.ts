import { Component, OnInit, inject, signal } from '@angular/core';
import { Local } from '../../../core/models/local.model';
import { LocalCard } from '../local-card/local-card';
import { LocalFormModal } from '../local-form-modal/local-form-modal';
import { LocalesService } from '../locales.service';

@Component({
  selector: 'app-locales-page',
  imports: [LocalCard, LocalFormModal],
  templateUrl: './locales-page.html',
  styleUrl: './locales-page.scss',
})
export class LocalesPage implements OnInit {
  private readonly localesService = inject(LocalesService);

  protected readonly locales = this.localesService.all;
  protected readonly isLoading = this.localesService.isLoading;
  protected readonly loadError = this.localesService.loadError;

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  ngOnInit(): void {
    this.localesService.load();
  }

  protected openModal(): void {
    this.saveError.set(null);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected async onLocalSaved(local: Omit<Local, 'id' | 'createdAt'>): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const { error } = await this.localesService.add(local);

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.closeModal();
  }
}
