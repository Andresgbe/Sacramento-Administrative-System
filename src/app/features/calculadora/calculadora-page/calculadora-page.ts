import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TasasCambioService } from '../../tasas-cambio/tasas-cambio.service';
import { SelectOnFocusDirective } from '../../../shared/directives/select-on-focus.directive';

type TasaKey = 'bcv' | 'paralelo' | 'usdt';
type Direccion = 'usd-a-bs' | 'bs-a-usd';

@Component({
  selector: 'app-calculadora-page',
  imports: [FormsModule, DecimalPipe, SelectOnFocusDirective],
  templateUrl: './calculadora-page.html',
  styleUrl: './calculadora-page.scss',
})
export class CalculadoraPage implements OnInit {
  private readonly tasasService = inject(TasasCambioService);

  protected readonly tasas = this.tasasService.current;
  protected readonly isLoading = this.tasasService.isLoading;
  protected readonly loadError = this.tasasService.loadError;

  protected readonly tasaKeys: TasaKey[] = ['bcv', 'paralelo', 'usdt'];
  protected readonly tasaLabel: Record<TasaKey, string> = {
    bcv: 'BCV',
    paralelo: 'Paralelo',
    usdt: 'USDT',
  };

  protected readonly tasaSeleccionada = signal<TasaKey>('bcv');
  protected readonly direccion = signal<Direccion>('usd-a-bs');
  protected readonly monto = signal(0);

  protected readonly resultado = computed(() => {
    const tasas = this.tasas();
    if (!tasas) {
      return 0;
    }

    const tasa = tasas[this.tasaSeleccionada()];
    return this.direccion() === 'usd-a-bs' ? this.monto() * tasa : this.monto() / tasa;
  });

  ngOnInit(): void {
    this.tasasService.load();
  }

  protected seleccionarTasa(tasa: TasaKey): void {
    this.tasaSeleccionada.set(tasa);
  }

  protected invertirDireccion(): void {
    this.direccion.update((actual) => (actual === 'usd-a-bs' ? 'bs-a-usd' : 'usd-a-bs'));
  }

  protected onMontoChange(value: string): void {
    this.monto.set(Number(value) || 0);
  }
}
