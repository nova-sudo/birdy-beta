"use client";

import { cn } from "@/lib/utils";
import { PdSegmented } from "./PdSegmented";

// The page-level tab bar — the segmented strip that sits above a hub's table
// and swaps which section is on screen (Overview / Leads / Members / Calls, and
// its equivalent on every other page).
//
// Every page had been re-typing the same sizing onto PdSegmented, or hand-
// skinning Radix's TabsList to look like it, so the strips drifted: different
// radii, different badge tints, different paddings. This is the one place that
// decides what a page tab bar looks like; a page only brings its own tabs.
//
// PdSegmented underneath still does the drawing and the roving-focus keyboard
// handling. What this adds is the page-level scale (13px labels, 15/7 padding),
// horizontal scrolling for strips that outgrow a narrow window, and the badge
// tints — purple on the tab you're on, neutral on the rest.

const ACTIVE_BADGE = "bg-pd-primary-tint text-pd-primary";
const IDLE_BADGE = "bg-pd-neutral-badge text-pd-subtle";

export function PageTabs({
  tabs,
  value,
  onChange,
  label,
  panelId,
  className,
  itemClassName,
}) {
  // A tab is `{ key, label, icon?, badge? }`. Semantic badges (a red triggered
  // count, say) can still pass their own badgeClassName and keep it.
  const options = tabs.map((tab) => ({
    ...tab,
    badgeClassName:
      tab.badgeClassName ?? (tab.key === value ? ACTIVE_BADGE : IDLE_BADGE),
  }));

  return (
    <PdSegmented
      role="tablist"
      label={label}
      panelId={panelId}
      options={options}
      value={value}
      onChange={onChange}
      // The track hugs its tabs rather than spanning the page: w-fit does that
      // anywhere, self-start also stops a flex row stretching it. self-start
      // alone was inert on Settings and Alerts, where the strip sits in a plain
      // block inside Radix's Tabs, and the bar ran the full window width.
      // max-w-full + overflow lets a strip too long for a narrow window scroll
      // instead of squeezing every label.
      className={cn("w-fit shrink-0 self-start max-w-full overflow-x-auto", className)}
      itemClassName={cn("shrink-0 px-[15px] py-[7px] text-[13px]", itemClassName)}
    />
  );
}

// The region a PageTabs strip swaps. Pages render the active section inside
// one of these so the tablist's aria-controls points at something real.
export function PageTabPanel({ id, label, className, children }) {
  return (
    <div id={id} role="tabpanel" aria-label={label} className={className}>
      {children}
    </div>
  );
}
