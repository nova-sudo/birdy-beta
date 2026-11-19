"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "./cn";
import { FOCUS_RING, LIFT } from "./motion";

/**
 * The bar for asking a section a question. Floats over the page content.
 *
 * @param {string} props.placeholder also the field's accessible name, e.g. "Ask Media Buyer about your clients"
 * @param {(text: string) => void} [props.onSubmit] called with the trimmed text; the bar then clears
 */
export function AskBar({ placeholder, onSubmit, className, ...props }) {
  const [value, setValue] = useState("");
  const text = value.trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text) return;
        onSubmit?.(text);
        setValue("");
      }}
      className={cn(
        "flex items-center gap-2.5 rounded-by-xl border border-by-line bg-by-surface py-2 pr-2 pl-4.5 shadow-by-floating",
        "transition-colors duration-(--by-dur-fast) ease-by-out focus-within:border-by-accent",
        className,
      )}
      {...props}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent font-by-body text-by-body-lg text-by-text outline-none placeholder:text-by-muted"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={!text}
        className={cn(
          "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-by-on-accent",
          "bg-linear-to-b from-by-primary-from to-by-primary-to shadow-by-primary",
          "hover:from-by-primary-from-hover hover:to-by-primary-to-hover hover:shadow-by-primary-hover",
          "disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4",
          LIFT,
          FOCUS_RING,
        )}
      >
        <ArrowUp aria-hidden="true" strokeWidth={2.4} />
      </button>
    </form>
  );
}
