import { Component, computed, input, signal } from '@angular/core';

export interface PieSegment {
  label: string;
  value: number;
  color: string;
  // Optional itemized breakdown (e.g. business names) shown under this
  // segment's legend entry — for when a bare count isn't specific enough.
  items?: string[];
}

interface ComputedWedge extends PieSegment {
  percentage: number;
  path: string;
}

@Component({
  selector: 'app-pie-chart',
  imports: [],
  templateUrl: './pie-chart.html',
  styleUrl: './pie-chart.scss',
})
export class PieChart {
  readonly segments = input.required<PieSegment[]>();

  protected readonly size = 160;
  protected readonly radius = 78;
  private readonly center = this.size / 2;

  protected readonly hoveredIndex = signal<number | null>(null);

  protected readonly total = computed(() =>
    this.segments().reduce((sum, segment) => sum + segment.value, 0),
  );

  protected readonly wedges = computed<ComputedWedge[]>(() => {
    const total = this.total();
    if (total === 0) {
      return [];
    }

    const nonZeroCount = this.segments().filter((segment) => segment.value > 0).length;

    // A single 100% segment can't be expressed as one SVG arc (start === end),
    // so draw it as a full circle instead of a wedge in that case.
    if (nonZeroCount === 1) {
      return this.segments().map((segment) => ({
        ...segment,
        percentage: segment.value > 0 ? 100 : 0,
        path: segment.value > 0 ? this.fullCirclePath() : '',
      }));
    }

    let cumulativeAngle = -90;
    return this.segments().map((segment) => {
      const fraction = segment.value / total;
      const sweep = fraction * 360;
      const path =
        segment.value > 0 ? this.wedgePath(cumulativeAngle, cumulativeAngle + sweep) : '';
      cumulativeAngle += sweep;
      return { ...segment, percentage: Math.round(fraction * 100), path };
    });
  });

  protected readonly hoveredSegment = computed<ComputedWedge | null>(() => {
    const index = this.hoveredIndex();
    return index === null ? null : (this.wedges()[index] ?? null);
  });

  protected onHover(index: number): void {
    this.hoveredIndex.set(index);
  }

  protected onLeave(): void {
    this.hoveredIndex.set(null);
  }

  private wedgePath(startDeg: number, endDeg: number): string {
    const start = this.pointOnCircle(startDeg);
    const end = this.pointOnCircle(endDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${this.center} ${this.center} L ${start.x} ${start.y} A ${this.radius} ${this.radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
  }

  private fullCirclePath(): string {
    const top = this.pointOnCircle(-90);
    const bottom = this.pointOnCircle(90);
    return (
      `M ${this.center} ${this.center} L ${top.x} ${top.y} ` +
      `A ${this.radius} ${this.radius} 0 1 1 ${bottom.x} ${bottom.y} ` +
      `A ${this.radius} ${this.radius} 0 1 1 ${top.x} ${top.y} Z`
    );
  }

  private pointOnCircle(angleDeg: number): { x: number; y: number } {
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: this.center + this.radius * Math.cos(angleRad),
      y: this.center + this.radius * Math.sin(angleRad),
    };
  }
}
