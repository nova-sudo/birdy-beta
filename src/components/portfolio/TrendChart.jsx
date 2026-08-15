"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { buildChartGeometry } from "@/lib/portfolio-chart";
import { deltaTone } from "@/lib/portfolio-metrics";
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
export function TrendChart({ chart, metrics, activeMetric, onMetricChange, redrawKey }) {
  const fillId = useId();
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const { points, linePath, areaPath } = useMemo(
    () => buildChartGeometry(chart.values),
    [chart.values]
  );

  const tone = deltaTone(chart.direction);
  const lastIndex = points.length - 1;

  return (
    <section className="mb-[18px] rounded-[16px] border border-pd-border bg-pd-surface px-[22px] py-5">
      <div className="mb-1.5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-pd-display text-[15px] font-semibold text-pd-ink">{chart.title}</h2>
          <p className="mt-0.5 text-[12px] text-pd-faint">{chart.subtitle}</p>
        </div>

        <PdSegmented
          label="Chart metric"
          className="shrink-0"
          itemClassName="px-[13px] py-[7px]"
          options={metrics.map((metric) => ({ key: metric.key, label: metric.tab }))}
          value={activeMetric}
          onChange={onMetricChange}
        />
      </div>

      <div className="mt-[14px] mb-4 flex items-baseline gap-[10px]">
        <span className="font-pd-display text-[28px] font-bold text-pd-ink">{chart.total}</span>
        <span className={cn("text-[12.5px] font-semibold", tone.text)}>
          <span aria-hidden="true">{chart.direction === "up" ? "▲" : "▼"}</span>
          <span className="sr-only">{chart.direction} </span> {chart.delta}
        </span>
      </div>

      {/* Names the shape of the series for anyone who can't see it — the dots
          below carry the individual readings. */}
      <p className="sr-only">
        {chart.title}, {chart.subtitle}. {chart.total}, {chart.direction} {chart.delta} on the
        previous period. {points.length} data points, from {chart.pointValues[0]} to{" "}
        {chart.pointValues[points.length - 1]}.
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

      <div className="mt-[9px] flex gap-[9px]">
        {chart.labels.map((label, i) => (
          <span key={i} className="flex-1 text-center text-[10.5px] text-pd-faint">
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
