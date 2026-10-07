"use client";

import { cn } from "@/lib/utils";
import { TrendPlot } from "./TrendPlot";
import { deltaTone } from "@/lib/portfolio-metrics";
import { PdCard } from "./PdCard";
import { PdSegmented } from "./PdSegmented";

/**
 * Portfolio trend chart: one metric over one timeframe, as a filled line.
 *
 * The handoff colours the total-row delta success-green unconditionally, which
 * misreads the timeframes where the metric actually fell (daily leads, weekly
 * spend, daily calls all trend down). Every other delta on this screen is
 * coloured by direction, so this one is too.
 */
export function TrendChart({ chart, metrics, activeMetric, onMetricChange, redrawKey, className }) {
  // Cost metrics invert: the Marketing Hub's CPL tab is bad news when it
  // rises, and has to read red even though the arrow points up. Colour by
  // meaning, never by direction. Metrics that pass no polarity keep the
  // higher-is-better default this chart already used.
  const tone = deltaTone(chart.direction, chart.polarity);

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
        {chart.coverage ? `, ${chart.coverage}` : ""}. {chart.values.length} data points, from{" "}
        {chart.pointValues[0]} to {chart.pointValues[chart.values.length - 1]}.
      </p>

      <TrendPlot chart={chart} redrawKey={redrawKey} />
    </PdCard>
  );
}
