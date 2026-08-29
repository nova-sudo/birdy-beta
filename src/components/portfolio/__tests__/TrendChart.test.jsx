import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendChart } from "../TrendChart";
import { bucketSeries } from "@/lib/portfolio-series";

/** A long daily range — the case that used to push the axis past the card. */
function longRangeChart() {
  const rows = Array.from({ length: 90 }, (_, i) => ({
    // 90 consecutive days from 1 Jan, so every row is its own bucket.
    at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
  }));
  const series = bucketSeries(rows, (r) => r.at, "Daily");

  return {
    title: "Total leads",
    subtitle: "Leads in this window",
    total: "90",
    direction: "up",
    delta: "10%",
    pointValues: series.values.map(String),
    ...series,
  };
}

const axisLabels = () => [...document.querySelectorAll("[data-axis-label]")];

describe("TrendChart axis", () => {
  it("renders only the dates worth printing, not one node per bucket", () => {
    // 90 buckets in a row of equal cells gives each one a few pixels — far
    // narrower than the date inside it, which is what overflowed the card.
    render(<TrendChart chart={longRangeChart()} metrics={[]} />);

    const printed = axisLabels();
    expect(printed.length).toBeGreaterThan(1);
    expect(printed.length).toBeLessThanOrEqual(12);
    expect(printed.every((l) => l.textContent.trim() !== "")).toBe(true);
  });

  it("anchors each date to its own point's x", () => {
    const chart = longRangeChart();
    render(<TrendChart chart={chart} metrics={[]} />);

    const lefts = axisLabels().map((l) => parseFloat(l.style.left));

    // Points sit centred over their bucket rather than flush to the frame, so
    // the first is inset by half a bucket and the last stops short of 100%.
    expect(lefts[0]).toBeGreaterThanOrEqual(0);
    expect(lefts[0]).toBeLessThan(5);
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
    expect(Math.max(...lefts)).toBeLessThanOrEqual(100);
  });

  it("holds the end dates inside the card instead of centring them", () => {
    render(<TrendChart chart={longRangeChart()} metrics={[]} />);
    const printed = axisLabels();

    // Centred, the first would hang off the left edge by half its width and
    // the last off the right.
    expect(printed[0].style.transform).toBe("translateX(0)");
    expect(printed[printed.length - 1].style.transform).toBe("translateX(-100%)");
    expect(printed[1].style.transform).toBe("translateX(-50%)");
  });

  it("keeps the axis a fixed height so the card cannot grow with the range", () => {
    render(<TrendChart chart={longRangeChart()} metrics={[]} />);

    const row = document.querySelector("[data-testid='chart-axis']");
    expect(row.className).toMatch(/\brelative\b/);
    expect(row.className).toMatch(/h-\[15px\]/);
  });

  it("keeps a tooltip reading for every point", () => {
    const chart = longRangeChart();
    render(<TrendChart chart={chart} metrics={[]} />);

    // Thinning is about the axis, not the data — each point stays reachable.
    expect(screen.getAllByRole("button")).toHaveLength(chart.values.length);
  });
});
