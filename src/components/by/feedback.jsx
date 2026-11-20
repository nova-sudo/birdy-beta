import { cn } from "./cn";

const TONES = {
  info: "bg-by-accent-soft text-by-text-2 [&_svg]:text-by-accent",
  warning: "bg-by-warning-bg text-by-warning",
  danger: "bg-by-danger-bg text-by-danger",
  success: "bg-by-success-bg text-by-success",
};

/**
 * A message inside a page or dialog: a hint, a warning, or what went wrong.
 *
 * @param {"info"|"warning"|"danger"|"success"} [props.tone]
 * @param {React.ReactNode} [props.icon] a lucide icon element
 * @param {React.ReactNode} [props.action] a button on the right, e.g. Retry
 */
export function Notice({ tone = "info", icon, action, className, children, ...props }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-center gap-2.5 rounded-by-md px-3 py-2.5 font-by-body text-by-body-sm [&_svg]:size-4 [&_svg]:shrink-0", TONES[tone] ?? TONES.info, className)}
      {...props}
    >
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

/** A grey placeholder bar shown while content loads. Size it with a class. */
export function Skeleton({ className, ...props }) {
  return <span aria-hidden="true" className={cn("block h-2.5 rounded-full bg-by-sunken motion-safe:animate-pulse", className)} {...props} />;
}
