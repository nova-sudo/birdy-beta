"use client";

// The pieces every card on a Context page shares, so the sub-agents and the lessons
// read in the same card language as Agency, Targets, How we work and Rules.

import { cn } from "@/components/by";

/** The small uppercase heading between blocks ("Your agency", "Lessons from chat"). */
export function SubHeading({ id, className, children }) {
  return <h3 id={id} className={cn("text-by-caption font-semibold tracking-[0.06em] text-by-muted uppercase", className)}>{children}</h3>;
}

/** A card's head row: its icon tile, its title, and one action on the right. */
export function ContextCardHead({ icon: Icon, title, id, accent = false, action }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span aria-hidden="true" className={cn("grid size-[30px] shrink-0 place-items-center rounded-[9px] [&_svg]:size-[15px]", accent ? "bg-by-accent text-by-on-accent" : "bg-by-accent-soft text-by-accent")}>
        <Icon />
      </span>
      <h3 id={id} className="min-w-0 flex-1 truncate font-by-display text-by-body-lg font-semibold">{title}</h3>
      {action}
    </div>
  );
}
