import { ChevronRight } from "lucide-react";
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

/** A header cell. @param {boolean} [props.numeric] right-aligned, for number columns */
export function Th({ numeric = false, className, ...props }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-10 whitespace-nowrap border-b border-by-line px-4 text-left text-by-label font-semibold uppercase tracking-[0.07em] text-by-muted",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
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
