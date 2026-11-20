import { ChevronRight } from "lucide-react";
import { cn } from "./cn";

/**
 * The steps a lead passes through, left to right, with the count at each.
 *
 * @param {{key: string, label: string, icon: React.ReactNode, value: string, note?: React.ReactNode, muted?: boolean}[]} props.stages
 *   `note` sits under the count (usually a Delta or "29% of leads"); `muted` greys a step with no data
 */
export function Funnel({ stages, className, ...props }) {
  return (
    <ol className={cn("flex items-start font-by-body", className)} {...props}>
      {stages.map((stage, i) => (
        <li key={stage.key} className="flex min-w-0 flex-1 items-start">
          {i > 0 && <ChevronRight aria-hidden="true" className="mt-2.5 size-4 shrink-0 text-by-line-strong" />}
          <div className="min-w-0 flex-1 text-center">
            <span aria-hidden="true" className={cn("mx-auto grid size-9 place-items-center rounded-full [&_svg]:size-[18px]", stage.muted ? "bg-by-sunken text-by-muted" : "bg-by-accent-soft text-by-accent")}>
              {stage.icon}
            </span>
            <div className="mt-2 truncate text-by-body-sm text-by-text-2">{stage.label}</div>
            <div className={cn("font-by-display text-by-title font-semibold tabular-nums", stage.muted ? "text-by-muted" : "text-by-text")}>{stage.value}</div>
            {stage.note && <div className="mt-0.5 text-by-caption text-by-muted">{stage.note}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
