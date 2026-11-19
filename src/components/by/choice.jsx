"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as RadioPrimitive from "@radix-ui/react-radio-group";
import { Check } from "lucide-react";
import { cn } from "./cn";
import { FOCUS_RING } from "./motion";

const LABEL = "inline-flex cursor-pointer items-center gap-2 font-by-body text-by-body text-by-text has-disabled:cursor-default has-disabled:opacity-45";
const POP = "motion-safe:animate-[by-pop_var(--by-dur-press)_var(--by-ease-spring)]";
const COLOURS = "transition-colors duration-(--by-dur-fast) ease-by-out";

/** Wrap a control in its label when one is given, so the text is clickable. */
function Labelled({ label, className, children }) {
  if (!label) return children;
  // min-w-0 lets a long label shorten with an ellipsis instead of pushing the row wider.
  return <label className={cn(LABEL, className)}>{children}<span className="min-w-0">{label}</span></label>;
}

/**
 * An on/off switch. Takes Radix Switch props (`checked`, `defaultChecked`, `onCheckedChange`).
 * @param {string} [props.label] clickable text beside it; without it pass `aria-label`
 */
export function Switch({ label, className, ...props }) {
  return (
    <Labelled label={label} className={className}>
      <SwitchPrimitive.Root
        className={cn(
          "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-by-line-strong p-0.5 disabled:cursor-default",
          "transition-colors duration-(--by-dur-base) ease-by-out data-[state=checked]:bg-by-accent",
          FOCUS_RING,
          !label && className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb className="block size-4 rounded-full bg-by-surface shadow-by-raised transition-transform duration-(--by-dur-base) ease-by-spring data-[state=checked]:translate-x-4 motion-reduce:transition-none" />
      </SwitchPrimitive.Root>
    </Labelled>
  );
}

/**
 * A checkbox. Takes Radix Checkbox props (`checked`, `defaultChecked`, `onCheckedChange`).
 * @param {string} [props.label] clickable text beside it; without it pass `aria-label`
 */
export function Checkbox({ label, className, ...props }) {
  return (
    <Labelled label={label} className={className}>
      <CheckboxPrimitive.Root
        className={cn(
          "grid size-4.5 shrink-0 cursor-pointer place-items-center rounded-by-sm border-[1.5px] border-by-line-strong bg-by-surface text-by-on-accent disabled:cursor-default",
          "hover:border-by-accent data-[state=checked]:border-by-accent data-[state=checked]:bg-by-accent",
          COLOURS,
          FOCUS_RING,
          !label && className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className={POP}>
          <Check aria-hidden="true" className="size-3" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </Labelled>
  );
}

/** A set of radio buttons; arrow keys move between them. Takes Radix RadioGroup props. */
export function RadioGroup({ className, ...props }) {
  return <RadioPrimitive.Root className={cn("flex flex-wrap gap-x-5 gap-y-2", className)} {...props} />;
}

/**
 * One choice in a RadioGroup.
 * @param {string} props.value
 * @param {string} [props.label] clickable text beside it; without it pass `aria-label`
 */
export function Radio({ label, className, ...props }) {
  return (
    <Labelled label={label} className={className}>
      <RadioPrimitive.Item
        className={cn(
          "grid size-4.5 shrink-0 cursor-pointer place-items-center rounded-full border-[1.5px] border-by-line-strong bg-by-surface disabled:cursor-default",
          "hover:border-by-accent data-[state=checked]:border-by-accent",
          COLOURS,
          FOCUS_RING,
          !label && className,
        )}
        {...props}
      >
        <RadioPrimitive.Indicator className={cn("block size-2 rounded-full bg-by-accent", POP)} />
      </RadioPrimitive.Item>
    </Labelled>
  );
}
