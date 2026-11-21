"use client";

// Small pieces the plan and credits cards share: the allowance ring and a
// card heading.

import { cn } from "@/components/by";

/** A card's title and the quieter line under it. */
export function CardHeading({ title, sub, aside }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="font-by-display text-by-body-lg font-bold">{title}</h3>
        {sub && <p className="mt-0.5 text-by-body-sm text-by-text-2">{sub}</p>}
      </div>
      {aside}
    </div>
  );
}

const R = 38;
const C = 2 * Math.PI * R;
const STROKE = { danger: "stroke-by-danger-solid", warning: "stroke-by-warning-solid", accent: "stroke-by-accent" };

/** The share of this period's allowance left, as a ring with the figure inside. */
export function AllowanceRing({ percent, tone = "accent" }) {
  return (
    <div className="relative size-[92px] shrink-0">
      <svg viewBox="0 0 92 92" className="size-full" role="img" aria-label={`${Math.round(percent)}% of this period's credits left`}>
        <circle cx="46" cy="46" r={R} fill="none" strokeWidth="9" className="stroke-by-sunken" />
        <circle
          cx="46" cy="46" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * C} ${C}`} transform="rotate(-90 46 46)"
          className={cn(STROKE[tone] ?? STROKE.accent, "transition-[stroke-dasharray] duration-700 ease-by-out")}
        />
      </svg>
      <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-by-display text-by-body-lg font-bold tabular-nums">{Math.round(percent)}%</span>
    </div>
  );
}
