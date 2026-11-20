import { cn } from "./cn";

const TONES = {
  danger: "bg-by-danger-bg text-by-danger",
  warning: "bg-by-warning-bg text-by-warning",
  success: "bg-by-success-bg text-by-success",
  accent: "bg-by-accent-soft text-by-accent",
  neutral: "bg-by-sunken text-by-text-2",
};

/**
 * A status pill: tinted background, a dot, short text. One style for every status.
 *
 * @param {"danger"|"warning"|"success"|"accent"|"neutral"} [props.tone]
 * @param {boolean} [props.dot] the leading dot; on by default
 */
export function Pill({ tone = "neutral", dot = true, className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-by-sm px-2 py-0.5 font-by-body text-by-caption font-semibold",
        TONES[tone] ?? TONES.neutral,
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/**
 * A cost-per-lead figure coloured by how it compares with the client's limit.
 * @param {"danger"|"warning"|"success"} props.tone over the limit, near it, or under it
 */
export function CplChip({ tone, className, children, ...props }) {
  return <Pill tone={tone} dot={false} className={cn("text-by-body tabular-nums", className)} {...props}>{children}</Pill>;
}

/** A small round count, such as the number of open suggestions on a tab. */
export function CountBadge({ className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-grid h-4.5 min-w-4.5 place-items-center rounded-full bg-by-accent px-1 font-by-body text-by-label font-semibold text-by-on-accent tabular-nums",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
