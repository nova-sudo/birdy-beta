"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { buildChartGeometry } from "@/lib/portfolio-chart";

const GRID_LINES = 5;

/**
 * The plot itself: baseline grid, filled line, hoverable dots and the dated
 * axis. No header, no headline figure — TrendChart and MetricTabsChart each
 * put their own chrome around this and share the drawing.
 *
 * @param {{values: number[], labels: string[], tooltipLabels: string[], pointValues: string[]}} chart
 * @param {string} [redrawKey] remounts the paths so the draw animation replays
 * @param {string} [heightClassName] the plot area's height, default 190px
 */
export function TrendPlot({ chart, redrawKey, heightClassName = "h-[190px]", className }) {
  const fillId = useId();
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const { points, linePath, areaPath } = useMemo(
    () => buildChartGeometry(chart.values),
    [chart.values]
  );
  const lastIndex = points.length - 1;

  // bucketSeries blanks most labels so a long axis stays readable; the two it
  // keeps at the ends are the ones that need anchoring rather than centring.
  const printedLabelIndices = useMemo(
    () => chart.labels.reduce((kept, label, i) => (label ? [...kept, i] : kept), []),
    [chart.labels]
  );
  const firstLabelIndex = printedLabelIndices[0];
  const lastLabelIndex = printedLabelIndices[printedLabelIndices.length - 1];

  return (
    <div className={className}>
      <div className={cn("relative", heightClassName)}>
        {/* Baseline grid — the bottom rule sits a shade darker than the rest. */}
        <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
          {Array.from({ length: GRID_LINES }).map((_, i) => (
            <div
              key={i}
              className={cn("h-px", i === GRID_LINES - 1 ? "bg-pd-border" : "bg-pd-divider")}
            />
          ))}
        </div>

        {/* Keying on metric + timeframe remounts the paths, which is what makes
            the draw and fade animations replay on every switch. */}
        <svg
          key={redrawKey}
          viewBox="0 0 1000 200"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--pd-primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--pd-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="pd-chart-area" d={areaPath} fill={`url(#${fillId})`} />
          <path
            className="pd-chart-line"
            d={linePath}
            fill="none"
            stroke="var(--pd-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            // Without this the non-uniform viewBox scaling would squash the
            // stroke horizontally along with everything else. The reveal is a
            // clip wipe (globals.css) because a stroke dash can't be measured
            // in screen space from here.
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Dots are HTML rather than SVG so they stay circular under the
            stretched viewBox, and so the tooltip can hang off them. They are
            buttons because the tooltip is the only place a reading of an
            individual period exists. */}
        {points.map((point, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${chart.tooltipLabels[i]}: ${chart.pointValues[i]}`}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex((current) => (current === i ? null : current))}
            onFocus={() => setHoveredIndex(i)}
            onBlur={() => setHoveredIndex((current) => (current === i ? null : current))}
            className={cn(
              "absolute -mt-[5px] -ml-[5px] size-[10px] cursor-pointer rounded-full border-2 border-white",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary",
              i === lastIndex ? "bg-pd-primary shadow-pd-glow" : "bg-pd-primary-light"
            )}
            style={{ left: `${point.xPercent.toFixed(2)}%`, top: `${point.yPercent.toFixed(2)}%` }}
          >
            {/* A 10px dot is a mean hit target — widen it without moving it. */}
            <span className="absolute -inset-2" aria-hidden="true" />

            {hoveredIndex === i && (
              <div className="pd-tooltip pointer-events-none absolute bottom-[15px] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl bg-pd-ink px-[10px] py-1.5 text-white shadow-pd-tooltip">
                <div className="font-pd-display text-[12.5px] font-bold leading-none">
                  {chart.pointValues[i]}
                </div>
                <div className="mt-[3px] text-[10.5px] text-pd-primary-pale">
                  {chart.tooltipLabels[i]}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Dates are placed at their point's x rather than laid out in a row of
          cells: a row gives each bucket an equal share of the width, which a
          long range shrinks below the width of the date printed in it. Only
          the printed dates exist, each anchored to the point it describes. */}
      <div className="relative mt-[9px] h-[15px]" data-testid="chart-axis">
        {chart.labels.map((label, i) =>
          label ? (
            <span
              key={i}
              data-axis-label
              className={cn(
                "absolute top-0 whitespace-nowrap text-[10.5px] text-pd-faint",
                // A phone-width card fits about four dates before they run
                // into each other; every second one steps aside there,
                // counting back from the last so today's date always stays.
                printedLabelIndices.length > 4 &&
                  (printedLabelIndices.length - 1 - printedLabelIndices.indexOf(i)) % 2 === 1 &&
                  "max-sm:hidden"
              )}
              style={{
                left: `${points[i]?.xPercent.toFixed(2) ?? 0}%`,
                // Centred on its point, except at the ends: the first date
                // starts at its point and the last one finishes at its point,
                // so neither can hang off the card.
                transform:
                  i === firstLabelIndex
                    ? "translateX(0)"
                    : i === lastLabelIndex
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
              }}
            >
              {label}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}
