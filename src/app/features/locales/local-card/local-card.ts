import { DecimalPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Local, LocalEstado } from '../../../core/models/local.model';

export type PagoStatus = 'al-dia' | 'debe';

@Component({
  selector: 'app-local-card',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './local-card.html',
  styleUrl: './local-card.scss',
})
export class LocalCard {
  @Input({ required: true }) local!: Local;
  @Input({ required: true }) pagoStatus!: PagoStatus;

  protected readonly estadoLabel: Record<LocalEstado, string> = {
    activo: 'Activo',
    inactivo: 'Inactivo',
    vencido: 'Vencido',
  };

  protected readonly pagoStatusLabel: Record<PagoStatus, string> = {
    'al-dia': 'Al día',
    debe: 'No ha pagado alquiler',
  };
}
