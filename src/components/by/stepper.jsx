import { Check } from "lucide-react";
import { cn } from "./cn";

/**
 * The steps of a flow, with the current one marked.
 *
 * @param {string[]} props.steps labels, in order
 * @param {number} props.current zero-based index of the current step
 */
export function Stepper({ steps, current, className, ...props }) {
  return (
    <ol className={cn("flex items-center gap-2 font-by-body text-by-body-sm font-semibold", className)} {...props}>
      {steps.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={label} aria-current={now ? "step" : undefined} className={cn("flex items-center gap-2", i > 0 && "flex-1")}>
            {i > 0 && <span aria-hidden="true" className={cn("h-px min-w-3 flex-1", done || now ? "bg-by-accent-line" : "bg-by-line")} />}
            <span
              className={cn(
                "grid size-5.5 shrink-0 place-items-center rounded-full border-[1.5px] text-by-caption tabular-nums",
                done && "border-transparent bg-by-success-bg text-by-success",
                now && "border-by-accent bg-by-accent text-by-on-accent",
                !done && !now && "border-by-line-strong bg-by-surface text-by-muted",
              )}
            >
              {done ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("whitespace-nowrap", done || now ? "text-by-text" : "text-by-muted")}>
              {label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
