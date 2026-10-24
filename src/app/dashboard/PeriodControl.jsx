"use client";

import { ChevronDown } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  SegmentedTabs,
} from "@/components/ds";
import { DATE_PRESETS } from "@/lib/constants";

const QUICK = [
  { value: "today", label: "Today" },
  { value: "last_7d", label: "7 days" },
  { value: "last_30d", label: "30 days" },
];

const MORE = DATE_PRESETS.filter((p) => !QUICK.some((q) => q.value === p.value));

/**
 * The dashboard's date range: three quick picks, and a "More" menu with every
 * other preset. Only one of the two ever shows a selection; when a "More"
 * preset is active the tabs are all unselected and the button names it.
 *
 * @param {{value: string, onChange: (preset: string) => void}} props
 */
export function PeriodControl({ value, onChange }) {
  const extra = MORE.find((p) => p.value === value);

  return (
    <div className="flex items-center gap-2">
      <SegmentedTabs
        ariaLabel="Period"
        // An unmatched value leaves every tab unselected.
        value={extra ? "" : value}
        onValueChange={onChange}
        items={QUICK}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={extra ? `More periods: ${extra.label}` : "More periods"}>
            {extra ? extra.label : "More"}
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {MORE.map((p) => (
              <DropdownMenuRadioItem key={p.value} value={p.value}>
                {p.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
