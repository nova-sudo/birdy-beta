"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CountUp, EASE_OUT } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { DeltaPill } from "./DeltaPill";
import { LoadingPulse } from "./LoadingPulse";
import { TrendPlot } from "./TrendPlot";

// ─── Metric tabs over a chart ───────────────────────────────────────────────
// The hub hero: a row of figures across the top of the card, and the trend of
// whichever one is selected beneath it. The figures *are* the chart's tabs —
// there is no separate KPI grid and no separate metric picker — so every
// number appears once, and each is one click from its own curve.
//
// A tab whose metric has no series (transfers on the Sales Hub, active
// campaigns on Marketing) is still a figure in the row; it just isn't
// selectable. The row keeps its order either way, so the same six numbers sit
// in the same places whichever hub you are on.

// The small dot before each label — the metric's colour family, in the same
// words tones.js uses, so a figure keeps its colour wherever it is drawn.
const DOT = {
  primary: "bg-pd-primary",
  info: "bg-pd-info",
  amber: "bg-pd-amber",
  warning: "bg-pd-amber",
  success: "bg-pd-success",
  danger: "bg-pd-danger",
  neutral: "bg-pd-faint",
};

const TAB_BASE =
  "relative flex min-w-0 flex-col items-start gap-[7px] px-4 pt-[14px] pb-3 text-left " +
  // Hairlines between figures: three across below lg (every third ends a
  // row, the last row has no rule beneath it), one row from lg up.
  "border-b border-r border-pd-divider [&:nth-child(3n)]:border-r-0 [&:nth-last-child(-n+3)]:border-b-0 " +
  "lg:border-b-0 lg:[&:nth-child(3n)]:border-r lg:last:border-r-0 " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pd-primary";

/**
 * @param {{key, label, value, direction?, delta?, polarity?, tone?, plottable?: boolean}[]} tabs
 *   the figures, in order. `value` is already formatted. `plottable: false`
 *   draws the figure without making it selectable.
 * @param {string} activeKey which tab's series is plotted
 * @param {(key: string) => void} onChange
 * @param {object|null} chart the active metric's series — the same shape
 *   TrendChart takes (title, subtitle, values, labels, tooltipLabels,
 *   pointValues, total), or null when there is nothing to plot
 * @param {boolean} [loading] figures not yet available: skeleton tabs
 * @param {boolean} [plotLoading] series still counting: pulse in the plot
 * @param {string[]} [loadingStatements] what the pulse says while it waits
 * @param {string} [emptyMessage] shown in the plot when `chart` is null
 * @param {string} [redrawKey] replays the draw animation on change
 * @param {string} [layoutId] distinct per instance when two charts share a screen
 */
export function MetricTabsChart({
  tabs,
  activeKey,
  onChange,
  chart,
  loading = false,
  plotLoading = false,
  loadingStatements,
  emptyMessage = "Nothing to plot for this window yet.",
  redrawKey,
  layoutId = "metric-tabs-chart",
  className,
}) {
  const columns = tabs.length;
  const panelId = useId();

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-pd-border bg-pd-surface shadow-sm",
        className
      )}
    >
      <div
        role={loading ? undefined : "tablist"}
        aria-label={loading ? undefined : "Chart metric"}
        // Three across until lg, then every figure in one row.
        className="grid grid-cols-3 border-b border-pd-border lg:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
        style={{ "--cols": columns }}
      >
        {loading
          ? tabs.map((tab) => (
              <div key={tab.key} className={cn(TAB_BASE, "cursor-default")}>
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-md" />
              </div>
            ))
          : tabs.map((tab) => {
              const active = tab.key === activeKey;
              const plottable = tab.plottable !== false;

              // A figure with no series is still a tab — disabled, so the row
              // keeps its order and the pattern stays one tablist — rather
              // than a plain box that assistive tech would find inside it.
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  id={`${panelId}-tab-${tab.key}`}
                  aria-selected={active}
                  aria-controls={plottable ? `${panelId}-panel` : undefined}
                  aria-disabled={plottable ? undefined : true}
                  disabled={!plottable}
                  onClick={plottable ? () => onChange?.(tab.key) : undefined}
                  className={cn(
                    TAB_BASE,
                    plottable
                      ? "cursor-pointer transition-colors hover:bg-pd-canvas"
                      : "cursor-default",
                    active && "bg-pd-primary-tint/40"
                  )}
                >
                  <span className="flex items-center gap-[7px] text-[11.5px] font-medium text-pd-subtle">
                    <span
                      className={cn("size-2 shrink-0 rounded-full", DOT[tab.tone] ?? DOT.primary)}
                      aria-hidden="true"
                    />
                    <span className="truncate">{tab.label}</span>
                    {!plottable && <span className="sr-only">, no trend available</span>}
                  </span>

                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span
                      className={cn(
                        "font-pd-display text-[21px] font-bold leading-none tracking-[-0.02em] tabular-nums",
                        active ? "text-pd-ink" : "text-pd-ink/90"
                      )}
                    >
                      {typeof tab.value === "string" || typeof tab.value === "number" ? (
                        <CountUp value={tab.value} />
                      ) : (
                        tab.value
                      )}
                    </span>
                    {tab.direction && (
                      <DeltaPill
                        size="sm"
                        direction={tab.direction}
                        value={tab.delta}
                        polarity={tab.polarity}
                      />
                    )}
                  </span>

                  {active && (
                    <motion.span
                      layoutId={layoutId}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                      className="absolute inset-x-0 -bottom-px h-[2px] bg-pd-primary"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
      </div>

      <div
        id={`${panelId}-panel`}
        role="tabpanel"
        aria-labelledby={`${panelId}-tab-${activeKey}`}
        className="flex min-w-0 flex-1 flex-col px-[18px] pt-[14px] pb-4"
      >
        {plotLoading ? (
          <LoadingPulse
            className="h-[214px] flex-1 border-0 shadow-none"
            statements={loadingStatements ?? ["Counting the period…"]}
          />
        ) : chart?.values?.length > 0 ? (
          <>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-pd-display text-[14px] font-semibold text-pd-ink">{chart.title}</h2>
              <span className="min-w-0 truncate text-[12px] text-pd-faint">{chart.subtitle}</span>
              {chart.plottedNote && (
                <span className="ml-auto text-[11.5px] text-pd-faint">{chart.plottedNote}</span>
              )}
            </div>
            <p className="sr-only">
              {chart.title}, {chart.subtitle}.{chart.plottedNote ? ` ${chart.plottedNote}.` : ""}{" "}
              {chart.values.length} data points, from {chart.pointValues[0]} to{" "}
              {chart.pointValues[chart.values.length - 1]}.
            </p>
            <TrendPlot chart={chart} redrawKey={redrawKey} heightClassName="h-[160px]" />
          </>
        ) : (
          <div className="flex h-[214px] flex-1 items-center justify-center">
            <p className="max-w-[40ch] text-center text-[12.5px] text-pd-faint">{emptyMessage}</p>
          </div>
        )}
      </div>
    </section>
  );
}
