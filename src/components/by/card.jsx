import { cn } from "./cn";

/**
 * The kit's surface: white, hairline border, the card shadow.
 * @param {boolean} [props.padded] 16px padding; off for tables and lists that run edge to edge
 */
export function Card({ padded = false, className, ...props }) {
  return <div className={cn("rounded-by-lg border border-by-line bg-by-surface shadow-by-card", padded && "p-4", className)} {...props} />;
}

/**
 * What a card or page shows when it has nothing to list.
 *
 * @param {React.ReactNode} [props.icon] a lucide icon element, shown in a tinted tile
 * @param {string} props.title
 * @param {React.ReactNode} [props.children] one or two lines saying why it is empty and what happens next
 * @param {React.ReactNode} [props.action] one button
 */
export function EmptyState({ icon, title, children, action, className, ...props }) {
  return (
    <div className={cn("flex flex-col items-center px-5 py-7 text-center", className)} {...props}>
      {icon && (
        <span aria-hidden="true" className="grid size-11 place-items-center rounded-by-lg bg-by-accent-soft text-by-accent [&_svg]:size-5">
          {icon}
        </span>
      )}
      <h3 className="mt-3 font-by-display text-by-heading font-semibold text-by-text text-balance">{title}</h3>
      {children && <p className="mt-1 max-w-[300px] text-by-body-sm text-by-text-2">{children}</p>}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}
