import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendChart } from "../TrendChart";
import { bucketSeries } from "@/lib/portfolio-series";
import { buildChartGeometry, VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "@/lib/portfolio-chart";

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

// The line is revealed by a wipe, and the reason it cannot be revealed by a
// stroke dash — which is what it used to be, twice — is worth pinning down,
// because both attempts read as "the line cuts off part way across" and
// neither fails visibly in jsdom.
//
// A dash reveal only works while the dash is at least as long as the line.
// The first attempt hardcoded 2400 viewBox units, which a long or jagged
// series outruns. The second normalised the dash with pathLength="1", which
// looks airtight but is measured in the wrong space: pathLength normalises
// against the path's length in USER units, while vector-effect:
// non-scaling-stroke moves the stroke — dashes included — into screen space.
// The viewBox is 1000 wide with preserveAspectRatio="none", so on a card
// wider than that the browser strokes a longer line than it sized the dash
// for, and the remainder is gap.
//
// The first block below is that premise, computed off the real geometry so it
// stays honest if the viewBox or the point spacing ever changes. The rest
// assert the reveal carries no length at all.

/** The line's length in the space the maths happens in: viewBox units. */
function userLength(points) {
  return points.reduce(
    (total, p, i) =>
      i === 0 ? 0 : total + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y),
    0
  );
}

/** ...and in the space the browser actually strokes it in, once the viewBox
 *  has been stretched across a card `cardWidth` CSS px wide. The plot box is
 *  a fixed 190px tall, so only the horizontal scale really moves. */
function strokedLength(points, cardWidth) {
  const sx = cardWidth / VIEWBOX_WIDTH;
  const sy = 190 / VIEWBOX_HEIGHT;
  return points.reduce(
    (total, p, i) =>
      i === 0
        ? 0
        : total +
          Math.hypot((p.x - points[i - 1].x) * sx, (p.y - points[i - 1].y) * sy),
    0
  );
}

describe("TrendChart line reveal", () => {
  const line = () => document.querySelector(".pd-chart-line");

  const stylesheet = async () => {
    const { readFileSync } = await import("node:fs");
    return readFileSync("src/app/globals.css", "utf8");
  };

  /** The wipe's two clip-paths, each split into its four inset edges. The
   *  keyframes nest braces, so the block runs to the closing one in column 0. */
  const wipeInsets = async () => {
    const block = (await stylesheet()).match(/@keyframes pd-chart-wipe\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const [from, to] = [...block.matchAll(/clip-path:\s*inset\(([^)]*)\)/g)].map((m) =>
      m[1].trim().split(/\s+/)
    );
    return { from, to };
  };

  it("is stroked in a space where the path's own length does not measure it", () => {
    render(<TrendChart chart={longRangeChart(7)} metrics={[]} />);

    // This is the attribute that moves the stroke into screen space, and so
    // the reason no length available on this side describes the dash.
    expect(line().getAttribute("vector-effect")).toBe("non-scaling-stroke");

    // A card wider than the viewBox stretches the line past the length any
    // pathLength normalisation would have sized a dash to, and a dash short
    // of the line leaves the rest as gap. 1400px is an ordinary desktop.
    for (const days of [7, 30, 90]) {
      const { points } = buildChartGeometry(longRangeChart(days).values);
      const drawn = userLength(points) / strokedLength(points, 1400);

      expect(drawn).toBeLessThan(0.8);
    }
  });

  it("reveals the line without measuring it at all", async () => {
    render(<TrendChart chart={longRangeChart()} metrics={[]} />);
    const rule = (await stylesheet()).match(/\.pd-chart-line\s*\{([^}]*)\}/)?.[1] ?? "";

    // Any of these is a length again, and some card is always wide enough to
    // outrun it.
    expect(line().getAttribute("pathLength")).toBe(null);
    expect(rule).not.toMatch(/stroke-dasharray/);
    expect(rule).toMatch(/animation:\s*pd-chart-wipe/);
  });

  it("wipes across the line's own box, so the sweep suits any series", async () => {
    const { from, to } = await wipeInsets();

    // The right edge is the one that travels: covering the line end to end at
    // the start, and clear of it by the end. A percentage of the line's own
    // box is the same sweep for a 7-day series and a 90-day one.
    expect(from[1]).toBe("100%");
    expect(parseFloat(to[1])).toBeLessThanOrEqual(0);
  });

  it("keeps the wipe's vertical margins absolute, since a flat series is flat", async () => {
    // Every value equal — the everyday "no leads all week" chart — is a
    // horizontal line, whose box has no height. A percentage of that is zero,
    // so percentage top/bottom insets would clip the stroke away entirely
    // rather than merely cutting its tail.
    const { points } = buildChartGeometry([0, 0, 0, 0, 0, 0, 0]);
    const ys = points.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(0);

    const { from, to } = await wipeInsets();
    for (const [top, , bottom] of [from, to]) {
      expect(top).not.toMatch(/%/);
      expect(bottom).not.toMatch(/%/);
    }
  });
});
