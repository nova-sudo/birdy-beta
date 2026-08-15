"use client";

import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";
import { buildChartGeometry } from "@/lib/portfolio-chart";
import { deltaTone } from "@/lib/portfolio-metrics";

const GRID_LINES = 5;

/**
 * Portfolio trend chart: one metric over one timeframe, as a filled line.
 *
 * The handoff colours the total-row delta success-green unconditionally, which
 * misreads the timeframes where the metric actually fell (daily leads, weekly
 * spend, daily calls all trend down). Every other delta on this screen is
 * coloured by direction, so this one is too.
 */
export function TrendChart({ chart, metrics, activeMetric, onMetricChange }) {
  const fillId = useId();
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

        {/* Metric segmented control */}
        <div className="flex shrink-0 gap-[5px] rounded-[10px] border border-pd-border bg-pd-divider p-1">
          {metrics.map((metric) => {
            const selected = metric.key === activeMetric;
            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => onMetricChange(metric.key)}
                className={cn(
                  "cursor-pointer rounded-lg px-[13px] py-[7px] font-pd-display text-[12.5px] font-semibold",
                  selected
                    ? "bg-pd-surface text-pd-ink shadow-pd-segment"
                    : "bg-transparent text-pd-muted"
                )}
              >
                {metric.tab}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-[14px] mb-4 flex items-baseline gap-[10px]">
        <span className="font-pd-display text-[28px] font-bold text-pd-ink">{chart.total}</span>
        <span className={cn("text-[12.5px] font-semibold", tone.text)}>
          {chart.direction === "up" ? "▲" : "▼"} {chart.delta}
        </span>
      </div>

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

        <svg
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
          <path d={areaPath} fill={`url(#${fillId})`} />
          <path
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
            stretched viewBox, and so a tooltip can hang off them in PR-05. */}
        {points.map((point, i) => (
          <div
            key={i}
            className={cn(
              "absolute -mt-[5px] -ml-[5px] size-[10px] rounded-full border-2 border-white",
              i === lastIndex ? "bg-pd-primary shadow-pd-glow" : "bg-pd-primary-light"
            )}
            style={{ left: `${point.xPercent.toFixed(2)}%`, top: `${point.yPercent.toFixed(2)}%` }}
          />
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
