import { describe, it, expect } from "vitest";
import {
  buildChartGeometry,
  pointXPercent,
  VERTICAL_PADDING,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
} from "@/lib/portfolio-chart";

describe("pointXPercent", () => {
  it("centres each point over its axis column rather than spanning edge to edge", () => {
    // With 12 points each owns 1/12 of the width, so the first sits half a
    // column in (100/24 ≈ 4.17%) and the last half a column from the right.
    expect(pointXPercent(0, 12)).toBeCloseTo(100 / 24, 5);
    expect(pointXPercent(11, 12)).toBeCloseTo(100 - 100 / 24, 5);
  });

  it("spaces points evenly between those insets", () => {
    const gaps = Array.from({ length: 11 }, (_, i) => pointXPercent(i + 1, 12) - pointXPercent(i, 12));
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 5);
  });

  it("centres a lone point", () => {
    expect(pointXPercent(0, 1)).toBe(50);
  });
});

describe("buildChartGeometry", () => {
  const values = [52, 61, 58, 70, 66, 74, 69, 80, 86, 79, 92, 100];

  it("puts the series minimum on the lower padding line and the maximum on the upper", () => {
    const { points } = buildChartGeometry(values);
    const lowest = points[values.indexOf(Math.min(...values))];
    const highest = points[values.indexOf(Math.max(...values))];

    expect(lowest.y).toBeCloseTo(VIEWBOX_HEIGHT - VERTICAL_PADDING, 5);
    expect(highest.y).toBeCloseTo(VERTICAL_PADDING, 5);
  });

  it("keeps every point inside the padded band", () => {
    const { points } = buildChartGeometry(values);
    for (const point of points) {
      expect(point.y).toBeGreaterThanOrEqual(VERTICAL_PADDING);
      expect(point.y).toBeLessThanOrEqual(VIEWBOX_HEIGHT - VERTICAL_PADDING);
    }
  });

  it("scales x into viewBox units consistently with the percentage", () => {
    const { points } = buildChartGeometry(values);
    for (const point of points) {
      expect(point.x).toBeCloseTo((point.xPercent * VIEWBOX_WIDTH) / 100, 5);
    }
  });

  it("draws the line through every point in order", () => {
    const { linePath } = buildChartGeometry([10, 20, 30]);
    expect(linePath.startsWith("M")).toBe(true);
    expect(linePath.match(/L/g)).toHaveLength(2);
  });

  it("closes the area at the first and last data points, not the frame edges", () => {
    const { points, areaPath } = buildChartGeometry(values);
    const first = points[0];
    const last = points[points.length - 1];

    expect(areaPath).toContain(`L${last.x.toFixed(1)} ${VIEWBOX_HEIGHT}`);
    expect(areaPath).toContain(`L${first.x.toFixed(1)} ${VIEWBOX_HEIGHT}`);
    expect(areaPath.endsWith("Z")).toBe(true);
    // The inset is what stops the fill splaying out past the line.
    expect(first.x).toBeGreaterThan(0);
    expect(last.x).toBeLessThan(VIEWBOX_WIDTH);
  });

  it("lands a flat series on the baseline instead of dividing by zero", () => {
    const { points } = buildChartGeometry([40, 40, 40]);
    for (const point of points) {
      expect(Number.isFinite(point.y)).toBe(true);
      expect(point.y).toBeCloseTo(VIEWBOX_HEIGHT - VERTICAL_PADDING, 5);
    }
  });

  it("returns empty geometry for an empty series rather than throwing", () => {
    expect(buildChartGeometry([])).toEqual({ points: [], linePath: "", areaPath: "" });
    expect(buildChartGeometry(undefined)).toEqual({ points: [], linePath: "", areaPath: "" });
  });
});
