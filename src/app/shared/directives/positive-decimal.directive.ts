import { Directive, HostListener } from '@angular/core';

// Blocks keys that a browser's type="number" input technically accepts
// (e/E for scientific notation, +/-) but that never make sense in a plain
// non-negative amount field, e.g. typing "e" into an empty/0 monto field.
@Directive({
  selector: '[appPositiveDecimal]',
})
export class PositiveDecimalDirective {
  private static readonly blockedKeys = new Set(['e', 'E', '+', '-']);

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (PositiveDecimalDirective.blockedKeys.has(event.key)) {
      event.preventDefault();
    }
  }
}
