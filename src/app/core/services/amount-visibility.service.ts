import { Injectable, effect, signal } from '@angular/core';

const HIDDEN_STORAGE_KEY = 'cc-sacramento:amounts-hidden';
const HIDDEN_CLASS = 'amounts-hidden';

/**
 * The "hide amounts" eye in the topbar. Masking is pure CSS: this only toggles
 * a class on <html>, and `styles.scss` swaps every money figure for asterisks
 * under it — so no template has to know the mode exists.
 */
@Injectable({ providedIn: 'root' })
export class AmountVisibilityService {
  private readonly hiddenState = signal(readStoredHidden());
  readonly hidden = this.hiddenState.asReadonly();

  constructor() {
    effect(() => {
      const hidden = this.hiddenState();
      document.documentElement.classList.toggle(HIDDEN_CLASS, hidden);
      try {
        localStorage.setItem(HIDDEN_STORAGE_KEY, String(hidden));
      } catch {
        // Storage blocked: the mode still works, it just won't survive a reload.
      }
    });
  }

  toggle(): void {
    this.hiddenState.update((hidden) => !hidden);
  }
}

function readStoredHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
