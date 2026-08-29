import { cn } from "@/lib/utils";
import { StatTile } from "./StatTile";

/**
 * A row of stats, either joined into one bordered strip (the KPI header) or
 * spaced out as separate bordered cells (the call-insights grid).
 *
 * @param {{key, icon, tone, value, label, direction?, delta?, polarity?}[]} stats
 * @param {"joined"|"separate"} variant
 */
export function StatStrip({ stats, variant = "joined", label, className }) {
  const joined = variant === "joined";

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        joined
          ? "flex rounded-[14px] border border-pd-border bg-pd-surface"
          : "flex gap-3",
        className
      )}
    >
      {stats.map((stat, i) => (
        <StatTile
          key={stat.key}
          {...stat}
          layout={joined ? "strip" : "cell"}
          // Hairlines between joined cells; the last one closes the strip.
          className={joined && i < stats.length - 1 ? "border-r border-pd-divider" : undefined}
        />
      ))}
    </div>
  );
}
