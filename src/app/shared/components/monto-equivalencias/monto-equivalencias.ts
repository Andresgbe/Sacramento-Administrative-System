import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { TasasCambioService } from '../../../features/tasas-cambio/tasas-cambio.service';

/**
 * The two lines that sit under every big money figure in the app.
 *
 * The figure above is in USDT/Cash, the app's unit of account. These restate
 * it in bolívares and then in official BCV dollars, both at today's rates and
 * both marked "≈" — they move as the rate does and are never what was typed.
 *
 * It reads the rate service directly rather than taking two more inputs: the
 * conversion is one rule for the whole app, and threading it through every
 * caller is how a second, divergent rule gets written.
 */
@Component({
  selector: 'app-monto-equivalencias',
  imports: [DecimalPipe],
  templateUrl: './monto-equivalencias.html',
  styleUrl: './monto-equivalencias.scss',
})
export class MontoEquivalencias {
  private readonly tasasCambio = inject(TasasCambioService);

  /** The amount shown above, in USDT/Cash dollars. */
  readonly monto = input.required<number>();

  protected readonly bolivares = computed(() => this.tasasCambio.aBolivares(this.monto()));
  protected readonly dolaresBcv = computed(() => this.tasasCambio.aDolaresBcv(this.monto()));
}
