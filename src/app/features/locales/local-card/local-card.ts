import { DecimalPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Local, LocalEstado } from '../../../core/models/local.model';

@Component({
  selector: 'app-local-card',
  imports: [DecimalPipe],
  templateUrl: './local-card.html',
  styleUrl: './local-card.scss',
})
export class LocalCard {
  @Input({ required: true }) local!: Local;

  protected readonly estadoLabel: Record<LocalEstado, string> = {
    activo: 'Activo',
    inactivo: 'Inactivo',
    vencido: 'Vencido',
  };
}
