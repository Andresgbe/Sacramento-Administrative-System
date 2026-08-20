import { Directive, HostListener } from '@angular/core';

// Selects the field's full value on focus so typing overwrites it instead of
// inserting next to it — mainly for number inputs that default to 0.
@Directive({
  selector: '[appSelectOnFocus]',
})
export class SelectOnFocusDirective {
  @HostListener('focus', ['$event'])
  onFocus(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }
}
