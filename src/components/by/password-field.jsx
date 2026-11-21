"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "./cn";
import { TextField } from "./field";
import { FOCUS_RING } from "./motion";

/**
 * A password field with a button that shows or hides what was typed.
 * Takes everything TextField takes; the lock icon is the default `leading`.
 */
export function PasswordField({ leading = <Lock aria-hidden="true" />, ...props }) {
  const [shown, setShown] = useState(false);
  const Icon = shown ? EyeOff : Eye;
  return (
    <TextField
      {...props}
      type={shown ? "text" : "password"}
      leading={leading}
      trailing={
        <button
          type="button"
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
          className={cn(
            "-mr-1.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-by-sm text-by-muted",
            "transition-colors duration-(--by-dur-fast) ease-by-out hover:bg-by-sunken hover:text-by-text",
            "[&_svg]:text-current",
            FOCUS_RING,
          )}
        >
          <Icon aria-hidden="true" />
        </button>
      }
    />
  );
}
