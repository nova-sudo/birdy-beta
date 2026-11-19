import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { FOCUS_RING } from "./motion";
import { cn } from "./cn";

/** A data table. Put it inside a Card for the bordered look. */
export function Table({ className, ...props }) {
  return <table className={cn("w-full border-collapse font-by-body text-by-body text-by-text", className)} {...props} />;
}

export function TableHead(props) {
  return <thead {...props} />;
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn("[&_tr:last-child_td]:border-b-0", className)} {...props} />;
}

/**
 * A table row.
 * @param {boolean} [props.interactive] highlights on hover and nudges its RowArrow; pair with onClick
 */
export function Tr({ interactive = false, className, ...props }) {
  return (
    <tr
      className={cn(interactive && "group cursor-pointer transition-colors duration-(--by-dur-fast) ease-by-out hover:bg-by-canvas", className)}
      {...props}
    />
  );
}

const SORT_LABEL = { asc: "ascending", desc: "descending" };

/**
 * A header cell.
 *
 * @param {boolean} [props.numeric] right-aligned, for number columns
 * @param {"asc"|"desc"|null} [props.sort] this column's current sort; pass with `onSort` to make the header a sort button
 * @param {() => void} [props.onSort] called when the header is pressed
 */
export function Th({ numeric = false, sort, onSort, className, children, ...props }) {
  const Arrow = sort === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={onSort ? SORT_LABEL[sort] ?? "none" : undefined}
      className={cn(
        "h-10 whitespace-nowrap border-b border-by-line px-4 text-left text-by-label font-semibold uppercase tracking-[0.07em] text-by-muted",
        numeric && "text-right",
        className,
      )}
      {...props}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            "-mx-1.5 inline-flex cursor-pointer items-center gap-1 rounded-by-sm px-1.5 py-1 uppercase tracking-[0.07em] transition-colors duration-(--by-dur-fast) ease-by-out hover:text-by-text",
            sort && "text-by-text",
            FOCUS_RING,
          )}
        >
          {/* The arrow keeps its space when the column is not sorted, so headers do not shift. */}
          {numeric && <Arrow aria-hidden="true" className={cn("size-3", !sort && "opacity-0")} />}
          {children}
          {!numeric && <Arrow aria-hidden="true" className={cn("size-3", !sort && "opacity-0")} />}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

/** A body cell. @param {boolean} [props.numeric] right-aligned with figures that line up in columns */
export function Td({ numeric = false, className, ...props }) {
  return <td className={cn("h-12 whitespace-nowrap border-b border-by-line-soft px-4", numeric && "text-right tabular-nums", className)} {...props} />;
}

/** The trailing arrow on an interactive row. It nudges right when the row is hovered. */
export function RowArrow({ className, ...props }) {
  return (
    <td className={cn("h-12 w-9 border-b border-by-line-soft pr-3 text-by-muted", className)} {...props}>
      <ChevronRight
        aria-hidden="true"
        className="size-4 transition-[transform,color] duration-(--by-dur-press) ease-by-spring group-hover:text-by-text motion-safe:group-hover:translate-x-1"
      />
    </td>
  );
}
