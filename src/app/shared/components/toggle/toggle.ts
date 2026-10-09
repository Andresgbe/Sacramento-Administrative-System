import { Component, input, output } from '@angular/core';

/**
 * The app's on/off switch, for a single boolean the user flips in place.
 *
 * Distinct from `<app-tabs>`, which picks one of several options: this one
 * has no third state and writes immediately, with no save step.
 */
@Component({
  selector: 'app-toggle',
  imports: [],
  templateUrl: './toggle.html',
  styleUrl: './toggle.scss',
})
export class Toggle {
  readonly checked = input.required<boolean>();
  readonly disabled = input(false);
  /** Read by screen readers; the switch carries no visible text of its own. */
  readonly label = input('');
  readonly toggled = output<boolean>();

  protected onClick(event: Event): void {
    // Cards are often clickable themselves (the locales grid wraps each one
    // in a routerLink), and flipping the switch must not navigate.
    event.stopPropagation();
    event.preventDefault();

    if (!this.disabled()) {
      this.toggled.emit(!this.checked());
    }
  }
}
