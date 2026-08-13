import { Component, computed, input, signal } from '@angular/core';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface ComputedSegment extends DonutSegment {
  percentage: number;
  dashArray: string;
  dashOffset: number;
}

@Component({
  selector: 'app-donut-chart',
  imports: [],
  templateUrl: './donut-chart.html',
  styleUrl: './donut-chart.scss',
})
export class DonutChart {
  readonly segments = input.required<DonutSegment[]>();
  readonly centerLabel = input('Total');

  protected readonly radius = 60;
  protected readonly strokeWidth = 22;
  private readonly gap = 3;
  private readonly circumference = 2 * Math.PI * this.radius;

  protected readonly hoveredIndex = signal<number | null>(null);

  protected readonly total = computed(() =>
    this.segments().reduce((sum, segment) => sum + segment.value, 0),
  );

  protected readonly computedSegments = computed<ComputedSegment[]>(() => {
    const total = this.total();
    if (total === 0) {
      return [];
    }

    let cumulative = 0;
    return this.segments().map((segment) => {
      const fraction = segment.value / total;
      const length = fraction * this.circumference;
      const visibleLength = Math.max(length - this.gap, 0);
      const result: ComputedSegment = {
        ...segment,
        percentage: Math.round(fraction * 100),
        dashArray: `${visibleLength} ${this.circumference - visibleLength}`,
        dashOffset: -cumulative,
      };
      cumulative += length;
      return result;
    });
  });

  protected readonly hoveredSegment = computed<ComputedSegment | null>(() => {
    const index = this.hoveredIndex();
    return index === null ? null : (this.computedSegments()[index] ?? null);
  });

  protected onHover(index: number): void {
    this.hoveredIndex.set(index);
  }

  protected onLeave(): void {
    this.hoveredIndex.set(null);
  }
}
