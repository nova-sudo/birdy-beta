"use client";

import { useId } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "./cn";

// The surface every field shares: white, hairline border, a slight inset
// shadow. Focus swaps the border for the accent and adds a 2px outline drawn
// just inside the edge, so there is no coloured halo around the field.
const SURFACE = cn(
  "flex h-9 w-full items-center gap-2 rounded-by-md border border-by-line bg-by-surface px-3",
  "font-by-body text-by-body text-by-text shadow-by-field",
  "transition-colors duration-(--by-dur-fast) ease-by-out hover:border-by-line-strong",
  "focus-within:border-by-accent focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-by-accent",
  "has-disabled:pointer-events-none has-disabled:opacity-45",
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-by-muted",
);
const INVALID = "border-by-danger-solid hover:border-by-danger-solid focus-within:border-by-danger-solid focus-within:outline-by-danger-solid";
const INPUT = "min-w-0 flex-1 bg-transparent outline-none placeholder:text-by-muted";

function Message({ id, error, help }) {
  if (error) return <p id={id} className="mt-1.5 text-by-caption text-by-danger">{error}</p>;
  if (help) return <p id={id} className="mt-1.5 text-by-caption text-by-muted">{help}</p>;
  return null;
}

/**
 * A labelled text field.
 *
 * @param {string} [props.label] shown above the field; without it pass `aria-label`
 * @param {string} [props.error] names the problem; turns the field red and is read out
 * @param {string} [props.help] a quiet hint under the field (hidden while there is an error)
 * @param {React.ReactNode} [props.leading] an icon before the text
 */
export function TextField({ label, error, help, leading, id, className, ...props }) {
  const auto = useId();
  const fieldId = id ?? auto;
  const messageId = error || help ? `${fieldId}-message` : undefined;
  return (
    <div className={className}>
      {label && <label htmlFor={fieldId} className="mb-1.5 block text-by-body-sm font-medium text-by-text">{label}</label>}
      <div className={cn(SURFACE, error && INVALID)}>
        {leading}
        <input id={fieldId} aria-invalid={error ? true : undefined} aria-describedby={messageId} className={INPUT} {...props} />
      </div>
      <Message id={messageId} error={error} help={help} />
    </div>
  );
}

/** A search field: the text field with a magnifier and the search input type. */
export function SearchField({ placeholder = "Search", "aria-label": ariaLabel, ...props }) {
  return <TextField type="search" leading={<Search aria-hidden="true" />} placeholder={placeholder} aria-label={ariaLabel ?? placeholder} {...props} />;
}

/**
 * A button that looks like a field and opens a list of choices, such as the
 * date range. It only draws the trigger; pair it with PopoverMenu.
 */
export function DropdownTrigger({ children, leading, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        SURFACE,
        "w-auto cursor-pointer shadow-by-raised focus-visible:border-by-accent focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-by-accent",
        className,
      )}
      {...props}
    >
      {leading}
      <span className="flex min-w-0 flex-1 items-baseline gap-2 truncate text-left">{children}</span>
      <ChevronDown aria-hidden="true" />
    </button>
  );
}
