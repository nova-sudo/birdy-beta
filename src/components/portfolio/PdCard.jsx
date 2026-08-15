import { cn } from "@/lib/utils";

/**
 * The card chrome every section on this screen shares: white surface, hairline
 * border, 16px radius, 20/22 padding, and an optional header with a title on
 * the left and a control or note on the right.
 *
 * @param {string} title rendered as the section heading
 * @param {React.ReactNode} action right-hand slot — a picker, a note, anything
 */
export function PdCard({ title, action, children, className, headerClassName }) {
  return (
    <section className={cn("rounded-[16px] border border-pd-border bg-pd-surface px-[22px] py-5", className)}>
      {(title || action) && (
        <div className={cn("flex items-center justify-between gap-3", headerClassName ?? "mb-4")}>
          {title && (
            <h2 className="font-pd-display text-[15px] font-semibold text-pd-ink">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
