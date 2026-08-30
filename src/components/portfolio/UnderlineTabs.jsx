"use client";

import { cn } from "@/lib/utils";

// The underlined page-tab bar from the Client Detail handoff (section 3): a
// full-width white strip under the client header, its tabs marked by a 2px
// purple rule that sits on the strip's own bottom border.
//
// Deliberately not PageTabs. The two are different controls doing different
// jobs, and the handoffs draw them that way: PageTabs is the segmented pill
// that switches which *section of a table* you are looking at inside one
// screen, while this switches which *workspace* you are in for a client —
// Overview, Ask Birdy, Marketing, Call Centre, Leads. Making this a segmented
// strip too would put two identical-looking controls on the same page doing
// different things, since the Marketing and Leads workspaces render their own
// PageTabs underneath this one.
//
// Values are the prototype's own, which disagrees with its README in two
// places; the rendered artifact wins. README says unselected #6B6480 and
// selected weight 700 — the runtime that actually drew the screen uses
// #8A8A9A (pd-subtle) and 600.

/**
 * @param {{key: string, label: string, icon?: React.ComponentType}[]} tabs
 * @param {string} value the selected tab's key
 * @param {(key: string) => void} onChange
 * @param {string} label accessible name for the tablist
 * @param {string} [panelId] id of the region these tabs swap
 *
 * The caller supplies `pdFontClass` on an ancestor, as PageTabs' callers do.
 * Importing it here would pull next/font into the portfolio barrel, and a
 * next/font call at module scope throws outside Next — which breaks every test
 * that imports anything from this barrel, not just this component.
 */
export function UnderlineTabs({ tabs, value, onChange, label, panelId, className }) {
  const onKeyDown = (event, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next = null;

    if (step) next = (index + step + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;

    event.preventDefault();
    onChange(tabs[next].key);
  };

  return (
    <div
      className={cn(
        // The strip runs the full width of the content column and carries the
        // hairline the selected tab's rule sits on.
        "border-b border-pd-border bg-pd-surface px-[26px] pt-3",
        className
      )}
    >
      {/* overflow-x-auto so a narrow window scrolls the strip rather than
          crushing five labels; the tabs keep their own width. */}
      <div role="tablist" aria-label={label} className="flex gap-[24px] overflow-x-auto">
        {tabs.map((tab, i) => {
          const selected = tab.key === value;
          const Icon = tab.icon;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              // Roving tabindex: only the selected tab is in the tab order.
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-[7px] whitespace-nowrap",
                // -mb-px pulls the rule down onto the container's border so the
                // two read as one line rather than stacking into 3px.
                "-mb-px border-b-2 pb-3 font-pd-display text-[13.5px]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary",
                selected
                  ? "border-pd-primary font-semibold text-pd-ink"
                  : "border-transparent font-medium text-pd-subtle hover:text-pd-ink"
              )}
            >
              {Icon && <Icon className="size-[15px] shrink-0" aria-hidden="true" />}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
