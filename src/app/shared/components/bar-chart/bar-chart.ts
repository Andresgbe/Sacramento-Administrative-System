import { DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';

export interface BarDatum {
  label: string;
  value: number;
}

@Component({
  selector: 'app-bar-chart',
  imports: [DecimalPipe],
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.scss',
})
export class BarChart {
  readonly data = input.required<BarDatum[]>();
  readonly color = input('var(--color-accent)');
  readonly valuePrefix = input('');

  protected readonly hoveredIndex = signal<number | null>(null);

  private readonly maxValue = computed(() =>
    Math.max(...this.data().map((item) => item.value), 1),
  );

  protected barHeight(value: number): number {
    return (value / this.maxValue()) * 100;
  }

  protected isMax(value: number): boolean {
    return value === this.maxValue();
  }

  protected onHover(index: number): void {
    this.hoveredIndex.set(index);
  }

  protected onLeave(): void {
    this.hoveredIndex.set(null);
  }
}
