import { CircleCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const STATES = {
  problem: {
    Icon: TriangleAlert,
    banner: "bg-pd-danger-surface border-pd-danger-border",
    chip: "bg-pd-danger-bg text-pd-danger",
    title: "text-pd-danger",
  },
  healthy: {
    Icon: CircleCheck,
    banner: "bg-pd-healthy-surface border-pd-healthy-border",
    chip: "bg-pd-success-bg text-pd-success",
    title: "text-pd-success",
  },
};

/**
 * The sentence under a chart or funnel that says what it means.
 *
 * @param {"problem"|"healthy"} state
 */
export function DiagnosticBanner({ state = "healthy", title, body, className }) {
  const s = STATES[state] ?? STATES.healthy;
  const Icon = s.Icon;

  return (
    <div
      className={cn("flex items-center gap-[11px] rounded-xl border px-4 py-[14px]", s.banner, className)}
    >
      <span
        className={cn("flex size-[30px] shrink-0 items-center justify-center rounded-[9px]", s.chip)}
      >
        <Icon className="size-[15px]" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className={cn("font-pd-display text-[13.5px] font-semibold", s.title)}>{title}</div>
        {body && <p className="mt-0.5 text-[12px] leading-[1.45] text-pd-body">{body}</p>}
      </div>
    </div>
  );
}
