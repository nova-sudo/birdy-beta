"use client";

import { DropdownTrigger, Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/by";

/**
 * A field-looking trigger that opens a list of choices.
 * @param {string} props.label read out as the control's name, with the current choice
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {[string, string][]} props.options value and text pairs
 */
export function SelectMenu({ label, value, onChange, options, className }) {
  const current = options.find(([v]) => v === value)?.[1] ?? options[0]?.[1] ?? "";
  return (
    <Menu>
      <MenuTrigger asChild>
        <DropdownTrigger aria-label={`${label}: ${current}`} className={className}>{current}</DropdownTrigger>
      </MenuTrigger>
      <MenuContent align="start" className="max-h-80 overflow-y-auto">
        {options.map(([v, text]) => (
          <MenuItem key={v || "all"} selected={v === value} onSelect={() => onChange(v)}>{text}</MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
