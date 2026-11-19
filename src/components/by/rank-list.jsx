import Link from "next/link";
import { cn } from "./cn";

const BAR = { accent: "bg-by-accent", danger: "bg-by-danger-solid" };

/**
 * A short ranked list: name, a bar for how it compares with the leader, and the figure.
 *
 * @param {{id: string, name: string, meta?: string, value: string, bar: number, href?: string, tone?: "accent"|"danger"}[]} props.items
 *   `bar` is 0-100; `href` makes the name a link; `tone: "danger"` marks a row that is over its limit
 * @param {boolean} [props.numbered] show the rank beside each row
 */
export function RankList({ items, numbered = true, className, ...props }) {
  return (
    <ol className={cn("font-by-body", className)} {...props}>
      {items.map((item, i) => (
        <li key={item.id} className="flex items-center gap-3 py-2">
          {numbered && (
            <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-by-sm bg-by-accent-soft text-by-caption font-semibold text-by-accent">{i + 1}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-by-body font-semibold text-by-text" title={item.name}>
              {item.href ? (
                <Link href={item.href} className="rounded-by-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">{item.name}</Link>
              ) : item.name}
            </div>
            {item.meta && <div className="truncate text-by-caption text-by-muted">{item.meta}</div>}
          </div>
          <span aria-hidden="true" className="hidden h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-by-sunken sm:block">
            <span className={cn("block h-full rounded-full", BAR[item.tone] ?? BAR.accent)} style={{ width: `${Math.max(4, Math.min(100, item.bar))}%` }} />
          </span>
          <span className={cn("w-16 shrink-0 text-right text-by-body font-semibold tabular-nums", item.tone === "danger" ? "text-by-danger" : "text-by-text")}>{item.value}</span>
        </li>
      ))}
    </ol>
  );
}
