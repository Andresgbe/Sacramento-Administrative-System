import { Component, computed, input, output, signal } from '@angular/core';

export interface MultiSelectOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-multi-select',
  imports: [],
  templateUrl: './multi-select.html',
  styleUrl: './multi-select.scss',
})
export class MultiSelect {
  readonly options = input.required<MultiSelectOption[]>();
  readonly selected = input.required<Set<string>>();
  /** Trigger text when nothing is selected, e.g. "Todos los locales". */
  readonly allLabel = input.required<string>();
  /** Noun used when several are selected, e.g. "locales seleccionados". */
  readonly countLabel = input.required<string>();

  readonly selectionChange = output<Set<string>>();

  protected readonly open = signal(false);

  protected readonly triggerLabel = computed(() => {
    const selected = this.selected();

    if (selected.size === 0) {
      return this.allLabel();
    }

    if (selected.size === 1) {
      const [id] = selected;
      const match = this.options().find((option) => option.id === id);
      if (match) {
        return match.label;
      }
    }

    return `${selected.size} ${this.countLabel()}`;
  });

  protected toggleMenu(): void {
    this.open.update((open) => !open);
  }

  protected closeMenu(): void {
    this.open.set(false);
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected toggleOption(id: string): void {
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectionChange.emit(next);
  }

  protected clear(): void {
    this.selectionChange.emit(new Set());
  }
}
