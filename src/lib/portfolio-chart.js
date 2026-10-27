// Geometry for the Portfolio Dashboard trend chart.
//
// The SVG uses viewBox "0 0 1000 200" with preserveAspectRatio="none", so it
// stretches to whatever width the card gives it while the maths stays in a
// fixed 1000×200 space. Percentages are what position the HTML point dots on
// top of it, hence both are returned.
//
// Two details from the handoff that are easy to get wrong, and that the dots
// visibly punish:
//
//   1. Points are centred over their axis label, not spread edge to edge. With
//      n points each owns a 100/n column and sits at its midpoint, so the first
//      and last dots are inset by half a column rather than touching the frame.
//   2. The area fill closes down to the baseline at the first and last *data
//      points*, not at the frame edges — otherwise it splays out past the line.

export const VIEWBOX_WIDTH = 1000;
export const VIEWBOX_HEIGHT = 200;
/** Vertical breathing room, in viewBox units, kept above and below the series. */
export const VERTICAL_PADDING = 14;

/**
 * Horizontal position of point `i` as a percentage of the plot width.
 * @param {number} i zero-based point index
 * @param {number} n total number of points
 */
export function pointXPercent(i, n) {
  if (n <= 1) return 50;
  const halfColumn = 100 / (2 * n);
  return halfColumn + (i * (100 - 2 * halfColumn)) / (n - 1);
}

/**
 * Turn a series into everything the chart needs to draw itself.
 *
 * Values are normalised between the series min and max, so each timeframe uses
 * the full height regardless of its absolute scale. A flat series (min === max)
 * divides by 1 rather than 0 and lands on the baseline.
 *
 * @param {number[]} values
 * @returns {{points: {x: number, y: number, xPercent: number, yPercent: number}[],
 *            linePath: string, areaPath: string}}
 */
export function buildChartGeometry(values) {
  const n = values?.length ?? 0;
  if (n === 0) return { points: [], linePath: "", areaPath: "" };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const usableHeight = VIEWBOX_HEIGHT - VERTICAL_PADDING * 2;

  const points = values.map((value, i) => {
    const xPercent = pointXPercent(i, n);
    const normalised = (value - min) / span;
    const y = VIEWBOX_HEIGHT - VERTICAL_PADDING - normalised * usableHeight;

    return {
      x: (xPercent * VIEWBOX_WIDTH) / 100,
      y,
      xPercent,
      yPercent: (y / VIEWBOX_HEIGHT) * 100,
    };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${linePath} L${last.x.toFixed(1)} ${VIEWBOX_HEIGHT} L${first.x.toFixed(1)} ${VIEWBOX_HEIGHT} Z`;

  return { points, linePath, areaPath };
}
