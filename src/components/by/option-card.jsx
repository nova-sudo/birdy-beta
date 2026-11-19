import { Check } from "lucide-react";
import { cn } from "./cn";
import { FOCUS_RING } from "./motion";

/**
 * A bordered row you pick: one of several (radio) or any of several (checkbox).
 *
 * @param {"radio"|"checkbox"} [props.role] radio by default
 * @param {boolean} props.selected
 * @param {() => void} props.onSelect
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.subtitle]
 * @param {React.ReactNode} [props.aside] sits before the mark, e.g. a "Used by …" pill
 * @param {boolean} [props.disabled]
 */
export function OptionCard({ role = "radio", selected, onSelect, title, subtitle, aside, disabled = false, className, ...props }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-by-md border px-3 py-2.5 text-left font-by-body text-by-body",
        "transition-colors duration-(--by-dur-fast) ease-by-out disabled:cursor-default disabled:opacity-55",
        selected ? "border-by-accent bg-by-accent-soft" : "border-by-line bg-by-surface hover:border-by-line-strong",
        FOCUS_RING,
        className,
      )}
      {...props}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-by-text">{title}</span>
        {subtitle && <span className="block text-by-caption text-by-muted">{subtitle}</span>}
      </span>
      {aside}
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4.5 shrink-0 place-items-center border-[1.5px]",
          role === "checkbox" ? "rounded-by-sm" : "rounded-full",
          selected ? "border-by-accent" : "border-by-line-strong",
          selected && role === "checkbox" && "bg-by-accent text-by-on-accent",
        )}
      >
        {selected && (role === "checkbox" ? <Check className="size-3" strokeWidth={3} /> : <span className="size-2 rounded-full bg-by-accent" />)}
      </span>
    </button>
  );
}
