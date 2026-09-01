import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendChart } from "../TrendChart";
import { bucketSeries } from "@/lib/portfolio-series";

/** A daily range of `days` buckets — 90 is the case that used to push the
 *  axis past the card, and the lengths are also what the draw dash had to
 *  cover. */
function longRangeChart(days = 90) {
  const rows = Array.from({ length: days }, (_, i) => ({
    // Consecutive days from 1 Jan, so every row is its own bucket.
    at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
  }));
  const series = bucketSeries(rows, (r) => r.at, "Daily");

  return {
    title: "Total leads",
    subtitle: "Leads in this window",
    total: String(days),
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

// The draw animation reveals the line by retracting a dash laid over it, so
// the dash has to be at least as long as the line. It used to be a fixed
// 2400 viewBox units, which a wide or jagged range outruns — the dash pattern
// then repeats and the rest of the line is simply gap, so it drew part way
// across and stopped dead while the area fill carried on underneath. A
// 30-day series is ~2100 units and over 5000 when jagged; 90 days averages
// ~5400.
//
// The fix is to stop measuring in units at all: pathLength="1" makes the
// browser treat the path as one unit long however long it really is, so a
// dash of 1 covers all of it. Both halves have to agree, hence the stylesheet
// is asserted too — pathLength="1" against a dasharray still in the thousands
// would be just as broken, and neither half fails visibly in jsdom.

describe("TrendChart line drawing", () => {
  const line = () => document.querySelector(".pd-chart-line");

  it("normalises the line's length so the draw dash always covers it", () => {
    render(<TrendChart chart={longRangeChart()} metrics={[]} />);

    expect(line().getAttribute("pathLength")).toBe("1");
  });

  it("normalises it whatever the range, since length is what broke it", () => {
    // 7 days always fitted inside the old dash, which is why this went
    // unnoticed; 30 is where it starts breaking and 90 where it always did.
    for (const days of [7, 30, 90]) {
      const { unmount } = render(
        <TrendChart chart={longRangeChart(days)} metrics={[]} />
      );
      expect(line().getAttribute("pathLength")).toBe("1");
      unmount();
    }
  });

  it("pairs it with a dash measured in fractions, not viewBox units", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/app/globals.css", "utf8");

    const rule = css.match(/\.pd-chart-line\s*\{([^}]*)\}/)?.[1] ?? "";
    const dash = Number(rule.match(/stroke-dasharray:\s*([\d.]+)/)?.[1]);
    const from = Number(
      css.match(/@keyframes pd-chart-draw\s*\{([^}]*\}[^}]*)\}/)?.[1]
        ?.match(/from\s*\{\s*stroke-dashoffset:\s*([\d.]+)/)?.[1]
    );

    // Anything above 1 is a length again, and a long enough line outruns it.
    expect(dash).toBe(1);
    expect(from).toBe(1);
  });
});
