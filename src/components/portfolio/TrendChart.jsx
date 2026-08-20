"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { buildChartGeometry } from "@/lib/portfolio-chart";
import { deltaTone } from "@/lib/portfolio-metrics";
import { PdCard } from "./PdCard";
import { PdSegmented } from "./PdSegmented";

const GRID_LINES = 5;

/**
 * Portfolio trend chart: one metric over one timeframe, as a filled line.
 *
 * The handoff colours the total-row delta success-green unconditionally, which
 * misreads the timeframes where the metric actually fell (daily leads, weekly
 * spend, daily calls all trend down). Every other delta on this screen is
 * coloured by direction, so this one is too.
 */
export function TrendChart({ chart, metrics, activeMetric, onMetricChange, redrawKey, className }) {
  const fillId = useId();
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const { points, linePath, areaPath } = useMemo(
    () => buildChartGeometry(chart.values),
    [chart.values]
  );

  const tone = deltaTone(chart.direction);
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
    <PdCard
      className={className}
      headerClassName="mb-1.5 items-start"
      title={
        <span className="block">
          <span className="block font-pd-display text-[15px] font-semibold text-pd-ink">
            {chart.title}
          </span>
          <span className="mt-0.5 block text-[12px] font-normal text-pd-faint">
            {chart.subtitle}
          </span>
        </span>
      }
      action={
        metrics?.length > 1 ? (
          <PdSegmented
            label="Chart metric"
            className="shrink-0"
            itemClassName="px-[13px] py-[7px]"
            options={metrics.map((metric) => ({ key: metric.key, label: metric.tab }))}
            value={activeMetric}
            onChange={onMetricChange}
          />
        ) : null
      }
    >

      <div className="mt-[14px] mb-4 flex flex-wrap items-baseline gap-[10px]">
        <span className="font-pd-display text-[28px] font-bold text-pd-ink">{chart.total}</span>
        {/* A window with no comparable period before it renders no delta at
            all, rather than a zero — an unknown movement is not a flat one,
            and the same rule already governs every KPI pill on these screens. */}
        {chart.direction && (
          <span className={cn("text-[12.5px] font-semibold", tone.text)}>
            <span aria-hidden="true">{chart.direction === "up" ? "▲" : "▼"}</span>
            <span className="sr-only">{chart.direction} </span> {chart.delta}
          </span>
        )}
        {chart.estimated && (
          // The total is exact; the curve under it is not counted — either a
          // sample scaled onto that total, or a shape borrowed from another
          // metric. Say which, rather than letting it read as measured.
          <span className="text-[11.5px] text-pd-faint">
            {chart.estimateNote ?? "shape estimated from a sample"}
          </span>
        )}
        {chart.coverage && (
          // The figure above is the sum of what was plotted. When the rows
          // behind it were capped, that is less than the portfolio total on
          // the tiles — say which leads it covers rather than letting the two
          // numbers look like a contradiction.
          <span className="text-[11.5px] text-pd-faint">{chart.coverage}</span>
        )}
      </div>

      {/* Names the shape of the series for anyone who can't see it — the dots
          below carry the individual readings. */}
      <p className="sr-only">
        {chart.title}, {chart.subtitle}. {chart.total}
        {chart.direction ? `, ${chart.direction} ${chart.delta} on the previous period` : ""}
        {chart.coverage ? `, ${chart.coverage}` : ""}. {points.length} data points, from{" "}
        {chart.pointValues[0]} to {chart.pointValues[points.length - 1]}.
      </p>

      <div className="relative h-[190px]">
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
            // stroke horizontally along with everything else.
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Dots are HTML rather than SVG so they stay circular under the
            stretched viewBox, and so the tooltip can hang off them.

            They are buttons because the tooltip is the only place a reading
            of an individual period exists — hover-only would put that data
            out of reach of anyone not using a mouse. */}
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
              <div className="pd-tooltip pointer-events-none absolute bottom-[15px] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-pd-ink px-[10px] py-1.5 text-white shadow-pd-tooltip">
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
          cells. A row gave each bucket an equal share of the width, which a
          long range shrinks to a few pixels — narrower than the date printed
          in it, so every label overflowed its cell and the axis ran off the
          side of the card. (text-align cannot rein that in: an inline box
          narrower than its text always draws from its left edge.) Positioning
          means only the printed dates exist, each one anchored to the point it
          describes. */}
      <div className="relative mt-[9px] h-[15px]" data-testid="chart-axis">
        {chart.labels.map((label, i) =>
          label ? (
            <span
              key={i}
              data-axis-label
              className="absolute top-0 whitespace-nowrap text-[10.5px] text-pd-faint"
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
    </PdCard>
  );
}
