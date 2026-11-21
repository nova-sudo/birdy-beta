"use client";

import { useId } from "react";
import { DropdownTrigger } from "./field";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./popover-menu";
import { cn } from "./cn";

/**
 * A labelled choice from a short list: the field-look trigger and a menu of
 * options. For a timezone, a currency, a time of day.
 *
 * @param {string} [props.label] shown above; without it pass `aria-label`
 * @param {string} props.value
 * @param {(value: string) => void} props.onValueChange
 * @param {{value: string, label: React.ReactNode}[]} props.options
 * @param {string} [props.placeholder] shown while no option matches `value`
 * @param {string} [props.help] a quiet hint under the field
 * @param {boolean} [props.disabled]
 */
export function SelectField({ label, value, onValueChange, options, placeholder = "Choose…", help, disabled = false, className, "aria-label": ariaLabel, id }) {
  const auto = useId();
  const fieldId = id ?? auto;
  const chosen = options.find((o) => o.value === value);
  return (
    <div className={className}>
      {label && <label htmlFor={fieldId} className="mb-1.5 block text-by-body-sm font-medium text-by-text">{label}</label>}
      <Menu>
        <MenuTrigger asChild disabled={disabled}>
          <DropdownTrigger id={fieldId} aria-label={ariaLabel} className={cn("w-full shadow-by-field", disabled && "pointer-events-none opacity-45")}>
            {chosen ? chosen.label : <span className="text-by-muted">{placeholder}</span>}
          </DropdownTrigger>
        </MenuTrigger>
        <MenuContent align="start" className="max-h-72 min-w-(--radix-dropdown-menu-trigger-width) overflow-y-auto">
          {options.map((o) => (
            <MenuItem key={o.value} selected={o.value === value} onSelect={() => onValueChange(o.value)}>{o.label}</MenuItem>
          ))}
        </MenuContent>
      </Menu>
      {help && <p className="mt-1.5 text-by-caption text-by-muted">{help}</p>}
    </div>
  );
}
