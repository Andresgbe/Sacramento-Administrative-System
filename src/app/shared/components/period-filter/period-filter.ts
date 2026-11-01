import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

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

/**
 * Whether a `YYYY-MM-DD` date falls inside the range, both ends included. An
 * empty end means no limit on that side. Compared as strings, never through
 * `new Date()`: a date-only string parses as UTC midnight and rolls back a day
 * in Venezuela (UTC-4). A stored timestamp is cut down to its date part.
 */
export function matchesRango(fecha: string, inicio: string, fin: string): boolean {
  const dia = fecha.slice(0, 10);
  return (!inicio || dia >= inicio) && (!fin || dia <= fin);
}

/**
 * The same test for something billed per month, whose date is only ever the
 * 1st (`facturas_servicio.periodo`). It matches if its MONTH touches the range:
 * the plain test would drop September's bill from "15 to 30 September".
 */
export function matchesRangoMensual(periodo: string, inicio: string, fin: string): boolean {
  const mes = periodo.slice(0, 7);
  return (!inicio || mes >= inicio.slice(0, 7)) && (!fin || mes <= fin.slice(0, 7));
}

/** "2026-09-01" → "Septiembre 2026". Done here rather than with DatePipe so
 *  no Spanish locale has to be registered app-wide for one label. */
export function formatPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  const nombre = MESES.find((m) => m.value === mes)?.label ?? mes;
  return `${nombre} ${anio}`;
}

function aFechaIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** First day of the current month: where the monthly report pages open. */
export function inicioMesActual(): string {
  const hoy = new Date();
  return aFechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
}

/** Last day of the current month. */
export function finMesActual(): string {
  const hoy = new Date();
  return aFechaIso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
}

/**
 * True when the range is exactly the current month — the resting state of the
 * monthly report pages and what "Limpiar filtros" returns to, so a freshly
 * loaded page shows the clear button disabled.
 */
export function esRangoMesActual(inicio: string, fin: string): boolean {
  return inicio === inicioMesActual() && fin === finMesActual();
}

@Component({
  selector: 'app-period-filter',
  imports: [FormsModule],
  templateUrl: './period-filter.html',
  styleUrl: './period-filter.scss',
})
export class PeriodFilter {
  /** `YYYY-MM-DD`, or '' for no limit on that side. */
  readonly inicio = input.required<string>();
  readonly fin = input.required<string>();

  readonly inicioChange = output<string>();
  readonly finChange = output<string>();
}
