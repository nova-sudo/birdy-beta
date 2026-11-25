"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "./cn";
import { buttonVariants } from "./button";

/**
 * The bar for asking a section a question. Floats over the page content.
 *
 * @param {string} props.placeholder also the field's accessible name, e.g. "Ask Media Buyer about your clients"
 * @param {(text: string) => void} [props.onSubmit] called with the trimmed text; the bar then clears
 * @param {boolean} [props.busy] a reply is on its way: typing is still possible, sending waits
 */
export function AskBar({ placeholder, onSubmit, busy = false, className, ...props }) {
  const [value, setValue] = useState("");
  const text = value.trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text || busy) return;
        onSubmit?.(text);
        setValue("");
      }}
      className={cn(
        // A pill with a soft purple glow, so it stands off the page it floats over.
        "flex items-center gap-2.5 rounded-full border border-by-accent-line bg-by-surface py-2 pr-2 pl-5.5 shadow-[0_0_0_4px_color-mix(in_srgb,var(--by-accent)_10%,transparent),0_10px_36px_-8px_color-mix(in_srgb,var(--by-accent)_45%,transparent)]",
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
        className="min-w-0 flex-1 bg-transparent font-by-body text-by-body-lg text-by-text caret-by-accent outline-none placeholder:text-by-muted"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={!text || busy}
        className={cn(buttonVariants({ kind: "primary", iconOnly: true }), "rounded-full")}
      >
        <ArrowUp aria-hidden="true" strokeWidth={2.4} />
      </button>
    </form>
  );
}
