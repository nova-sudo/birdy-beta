import { CalendarCheck, PoundSterling, Target, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeltaPill } from "./DeltaPill";

// One chip treatment per KPI — the tint carries the metric's identity through
// to the funnel and call-insights cards, so they stay in sync by key.
const CHIPS = {
  spend: { Icon: PoundSterling, className: "bg-pd-success-bg text-pd-success" },
  leads: { Icon: UserCheck, className: "bg-pd-info-bg text-pd-info" },
  cpl: { Icon: Target, className: "bg-pd-amber-bg text-pd-amber" },
  closes: { Icon: CalendarCheck, className: "bg-pd-primary-tint text-pd-primary" },
};

/** Four portfolio aggregates in one strip, divided by hairlines. */
export function KpiStrip({ kpis }) {
  return (
    <div
      role="group"
      aria-label="Portfolio KPIs"
      className="mb-[18px] flex rounded-[14px] border border-pd-border bg-pd-surface"
    >
      {kpis.map((kpi, i) => {
        const chip = CHIPS[kpi.icon];
        const Icon = chip.Icon;

        return (
          <div
            key={kpi.key}
            className={cn(
              "flex flex-1 items-center gap-[13px] px-5 py-4",
              i < kpis.length - 1 && "border-r border-pd-divider"
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
                chip.className
              )}
            >
              <Icon className="size-[17px]" aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <div className="font-pd-display text-[22px] font-bold leading-none text-pd-ink">
                {kpi.value}
              </div>
              <div className="mt-1 text-[12px] text-pd-subtle">{kpi.label}</div>
            </div>

            <DeltaPill
              className="ml-auto"
              direction={kpi.direction}
              value={kpi.delta}
              polarity={kpi.polarity}
            />
          </div>
        );
      })}
    </div>
  );
}
