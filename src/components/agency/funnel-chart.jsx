"use client";

import { funnel } from "dashkit/react";
import { cn } from "@/components/by";

// The dashboard kit's funnel widget, drawn outside a dashboard: bands that narrow from step to
// step, each with its value, its share of the first step and of the step before it. The widget
// reads a query frame, so the steps are handed to it in that shape.
const Bands = funnel.Component;
const SHOW = { showPercentOfFirst: true, showPercentOfPrevious: true };

// The kit colours each band from its chart palette. Here the bands step down Birdy's purple, first
// step solid, so the funnel reads as one thing narrowing and sits in the app's colours.
const mix = (pct) => `color-mix(in srgb, var(--by-accent) ${pct}%, var(--by-surface))`;
const BANDS = {
  "--dk-chart-1": "var(--by-accent)", "--dk-chart-2": mix(78), "--dk-chart-3": mix(58), "--dk-chart-4": mix(42),
  "--dk-chart-5": mix(32), "--dk-chart-6": mix(26), "--dk-chart-7": mix(22), "--dk-chart-8": mix(18),
};

/**
 * A funnel as a chart that fills the height it is given.
 *
 * @param {{key: string, label: string, value: number|null}[]} props.steps in order, first step first; at least two
 */
export function FunnelChart({ steps, className, ...props }) {
  const columns = steps.map((s) => ({ key: s.key, label: s.label, format: "integer" }));
  const widget = { data: SHOW, bindings: { query: { metrics: steps.map((s) => ({ metric: s.key, label: s.label })) } } };
  const frame = { columns, totals: { values: Object.fromEntries(steps.map((s) => [s.key, Number.isFinite(s.value) ? s.value : null])) } };
  return (
    // `dk-root` is the scope the kit's theme variables are defined on (app/globals.css).
    <div className={cn("dk-root flex min-h-[260px] flex-1 flex-col", className)} style={{ ...BANDS, background: "transparent" }} {...props}>
      <Bands widget={widget} frame={frame} />
    </div>
  );
}
