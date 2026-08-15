import { CalendarCheck, Layers, Phone, PhoneCall, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeltaPill } from "./DeltaPill";

const CHIPS = {
  phone: { Icon: Phone, className: "bg-pd-primary-tint text-pd-primary" },
  speed: { Icon: Zap, className: "bg-pd-amber-bg text-pd-amber" },
  // The handoff draws a phone crossed with an ×, which is lucide's
  // "phone-missed" — the opposite of what an answer rate means. Its own icon
  // table calls this one "phone-answer", so that is what it gets.
  answer: { Icon: PhoneCall, className: "bg-pd-info-bg text-pd-info" },
  effort: { Icon: Layers, className: "bg-pd-info-bg text-pd-info" },
  efficiency: { Icon: Target, className: "bg-pd-success-bg text-pd-success" },
  conversion: { Icon: CalendarCheck, className: "bg-pd-success-bg text-pd-success" },
};

/**
 * Call-centre aggregates across the whole portfolio.
 *
 * Half the row reads backwards from the usual "up is good": speed to lead and
 * calls per close are wins when they fall, and calls per lead is a loss when it
 * rises. Each metric carries its own polarity so the pills colour themselves.
 */
export function CallInsights({ insights }) {
  return (
    <section className="rounded-[16px] border border-pd-border bg-pd-surface px-[22px] py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-pd-display text-[15px] font-semibold text-pd-ink">Call insights</h2>
        <span className="text-[12px] text-pd-faint">Across all client call centres</span>
      </div>

      <div className="flex gap-3">
        {insights.map((insight) => {
          const chip = CHIPS[insight.icon];
          const Icon = chip.Icon;

          return (
            <div
              key={insight.key}
              className="min-w-0 flex-1 rounded-xl border border-pd-border px-[14px] py-[13px]"
            >
              <div className="mb-2.5 flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg",
                    chip.className
                  )}
                >
                  <Icon className="size-[14px]" aria-hidden="true" />
                </span>
                <DeltaPill
                  className="ml-auto"
                  size="sm"
                  direction={insight.direction}
                  value={insight.delta}
                  polarity={insight.polarity}
                />
              </div>

              <div className="font-pd-display text-[20px] font-bold leading-none text-pd-ink">
                {insight.value}
              </div>
              <div className="mt-[5px] truncate text-[11.5px] text-pd-subtle">{insight.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
