import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { FOCUS_RING } from "./motion";
import { cn } from "./cn";
import {
  TABLE_BODY_TEXT,
  TABLE_CARD,
  TABLE_HEAD_TEXT,
  TABLE_NAME_TEXT,
  TABLE_NUM,
  TABLE_ROW_H,
  TABLE_ROW_HOVER,
  TABLE_ROW_RULE,
  TABLE_TH,
  TABLE_TD,
} from "@/lib/table-style";

/**
 * A data table.
 *
 * Tables scroll inside themselves: put the table in a TableScroll (or any
 * height-bounded element with overflow) and its header row stays in place
 * while the rows move under it. The page around it does not scroll.
 */
export function Table({ className, ...props }) {
  return <table className={cn("w-full border-collapse font-by-body", TABLE_BODY_TEXT, className)} {...props} />;
}

export function TableHead(props) {
  return <thead {...props} />;
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn("[&_tr:last-child_td]:border-b-0", className)} {...props} />;
}

/**
 * A table row. Measurements and colours come from lib/table-style, shared with
 * the classic table.
 * @param {boolean} [props.interactive] highlights on hover and nudges its RowArrow; pair with onClick
 * @param {boolean} [props.tall] the taller row, for a cell with a second line under it
 */
export function Tr({ interactive = false, tall = false, className, ...props }) {
  return (
    <tr
      // Hover paints every cell at the same instant, no fade, so the row moves as one.
      className={cn(interactive && cn("group", TABLE_ROW_HOVER), tall && "[&>td]:h-[60px]", className)}
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
        // Sticky, so the header stays put while the rows scroll beneath it. The rule under it is an inset
        // shadow, not a border: a collapsed border does not travel with a sticky cell.
        "sticky top-0 z-10",
        TABLE_TH,
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
            "-mx-1.5 inline-flex cursor-pointer items-center gap-1 rounded-by-sm px-1.5 py-1 hover:text-by-text",
            TABLE_HEAD_TEXT,
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

/**
 * A body cell.
 * @param {boolean} [props.numeric] right-aligned with figures that line up in columns
 * @param {boolean} [props.primary] the cell that names the row: semibold, in full ink
 */
export function Td({ numeric = false, primary = false, className, ...props }) {
  return <td className={cn(TABLE_TD, "whitespace-nowrap", numeric && TABLE_NUM, primary && TABLE_NAME_TEXT, className)} {...props} />;
}

/**
 * The bordered card a table scrolls inside. It takes the height its parent
 * leaves it (the parent must be a flex column with a bounded height) and
 * scrolls both ways; a short table stays its own height.
 */
export function TableScroll({ className, ...props }) {
  return (
    <div
      className={cn("min-h-0 overflow-auto overscroll-contain", TABLE_CARD, className)}
      {...props}
    />
  );
}

/** The trailing arrow on an interactive row. It darkens with the row (no fade) and nudges right when the row is hovered. */
export function RowArrow({ className, ...props }) {
  return (
    <td className={cn(TABLE_ROW_H, TABLE_ROW_RULE, "w-9 pr-3 text-by-muted", className)} {...props}>
      <ChevronRight
        aria-hidden="true"
        className="size-4 transition-transform duration-(--by-dur-press) ease-by-spring group-hover:text-by-text motion-safe:group-hover:translate-x-1"
      />
    </td>
  );
}
