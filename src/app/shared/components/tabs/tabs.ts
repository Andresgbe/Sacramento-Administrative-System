import { Component, input, output } from '@angular/core';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
}

@Component({
  selector: 'app-tabs',
  imports: [],
  templateUrl: './tabs.html',
  styleUrl: './tabs.scss',
})
export class Tabs<T extends string = string> {
  readonly tabs = input.required<TabItem<T>[]>();
  readonly active = input.required<T>();
  readonly selected = output<T>();
}
