import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmpresaEstado } from '../../../core/models/empresa.model';
import { Local, PagoStatus } from '../../../core/models/local.model';
import { Toggle } from '../../../shared/components/toggle/toggle';

@Component({
  selector: 'app-local-card',
  imports: [DecimalPipe, RouterLink, Toggle],
  templateUrl: './local-card.html',
  styleUrl: './local-card.scss',
})
export class LocalCard {
  @Input({ required: true }) local!: Local;
  @Input({ required: true }) pagoStatus!: PagoStatus;
  /** Outstanding canon for the month; only meaningful when `parcial`. */
  @Input() faltante = 0;
  /** Canon deposited this month. Shown whenever it is non-zero — on an
   *  `al-dia` card it also surfaces an overpayment, which the status alone
   *  would hide. */
  @Input() pagado = 0;
  /**
   * Condominio for the CURRENT month. Set by hand, not derived: a condominio
   * pago carries no `local_id`, so there is nothing to compute it from.
   */
  @Input() condominioPagado = false;
  @Input() puedeEditarCondominio = false;
  @Output() readonly condominioToggled = new EventEmitter<boolean>();

  protected readonly estadoLabel: Record<EmpresaEstado, string> = {
    activo: 'Activo',
    inactivo: 'Inactivo',
    vencido: 'Vencido',
  };

  protected readonly pagoStatusLabel: Record<PagoStatus, string> = {
    'al-dia': 'Al día',
    parcial: 'Pago incompleto',
    debe: 'No ha pagado alquiler',
  };
}
