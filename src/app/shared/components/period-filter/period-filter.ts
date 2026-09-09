import { Component, input, output } from '@angular/core';

/** Shared by the filter's month select and any form that enters a period. */
export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
].map((label, index) => ({ value: String(index + 1).padStart(2, '0'), label }));

/** Years present in the given `YYYY-MM-DD` dates, newest first, plus the
 *  current one so the default selection is offered on an empty ledger. */
export function availableYears(fechas: string[]): string[] {
  const years = new Set(fechas.map((fecha) => fecha.slice(0, 4)));
  years.add(String(new Date().getFullYear()));
  return [...years].sort((a, b) => b.localeCompare(a));
}

/** Year and month are matched independently, so "todo 2026" and "todos los
 *  septiembres" are both expressible. An empty string means "todos". */
export function matchesPeriod(fecha: string, anio: string, mes: string): boolean {
  if (anio && fecha.slice(0, 4) !== anio) {
    return false;
  }
  if (mes && fecha.slice(5, 7) !== mes) {
    return false;
  }
  return true;
}

/** "2026-09-01" → "Septiembre 2026". Done here rather than with DatePipe so
 *  no Spanish locale has to be registered app-wide for one label. */
export function formatPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  const nombre = MESES.find((m) => m.value === mes)?.label ?? mes;
  return `${nombre} ${anio}`;
}

export function currentYear(): string {
  return String(new Date().getFullYear());
}

export function currentMonth(): string {
  return String(new Date().getMonth() + 1).padStart(2, '0');
}

@Component({
  selector: 'app-period-filter',
  imports: [],
  templateUrl: './period-filter.html',
  styleUrl: './period-filter.scss',
})
export class PeriodFilter {
  readonly anio = input.required<string>();
  readonly mes = input.required<string>();
  readonly anios = input.required<string[]>();

  readonly anioChange = output<string>();
  readonly mesChange = output<string>();

  protected readonly meses = MESES;

  protected onAnio(event: Event): void {
    this.anioChange.emit((event.target as HTMLSelectElement).value);
  }

  protected onMes(event: Event): void {
    this.mesChange.emit((event.target as HTMLSelectElement).value);
  }
}
