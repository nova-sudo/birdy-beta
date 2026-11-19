"use client";

import { cn } from "../cn";
import { TabPill } from "../tab-pill";

/**
 * The header of a section: its tile and name, the tab pill, and the date range.
 *
 * One row at 1440px and wider. Below that the tabs drop to a second row.
 *
 * @param {object} props.section an entry from SECTIONS
 * @param {string} [props.subtitle] defaults to the section's description; pass the client's name and status when scoped
 * @param {{value: string, label: string, count?: number, disabled?: boolean}[]} props.tabs
 * @param {string} props.tab the open tab
 * @param {(value: string) => void} props.onTabChange
 * @param {React.ReactNode} [props.more] the "More" menu trigger, shown inside the pill after the tabs
 * @param {React.ReactNode} [props.dateRange] shown on the right; omit on views that have no date range
 */
export function SectionHeader({ section, subtitle, tabs, tab, onTabChange, more, dateRange, className, ...props }) {
  const Icon = section.icon;
  return (
    <header
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3 border-b border-by-line bg-by-surface px-7 py-3.5 min-[1440px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
        className,
      )}
      {...props}
    >
      <div className="order-1 flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className={cn("grid size-10 shrink-0 place-items-center rounded-by-lg [&_svg]:size-[19px]", section.tile)}>
          <Icon />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-by-display text-by-title font-semibold tracking-[-0.01em] text-by-text">{section.name}</h1>
          <p className="truncate text-by-body-sm text-by-muted">{subtitle ?? section.description}</p>
        </div>
      </div>
      <div className="order-3 col-span-2 min-[1440px]:order-2 min-[1440px]:col-span-1">
        <TabPill items={tabs} value={tab} onValueChange={onTabChange} trailing={more} aria-label={`${section.name} views`} />
      </div>
      <div className="order-2 justify-self-end min-[1440px]:order-3">{dateRange}</div>
    </header>
  );
}
