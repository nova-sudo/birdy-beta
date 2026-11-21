"use client";

import { cn } from "../cn";
import { FOCUS_RING, LIFT } from "../motion";
import { Tooltip } from "../tooltip";

const R = 11.25;
const C = 2 * Math.PI * R;

/**
 * The rail's way into the setup checklist: a small ring of how much of setup
 * is done, with the percentage inside. Show it only while setup isn't finished.
 *
 * @param {number} props.percent 0 to 100, share of setup done
 * @param {() => void} props.onOpen opens the checklist
 * @param {boolean} [props.active] the setup page is open
 */
export function SetupRing({ percent, onOpen, active = false, className, ...props }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const label = `Setup checklist, ${pct}% done`;
  return (
    <Tooltip side="right" label={`Setup · ${pct}% done`}>
      <button
        type="button"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        onClick={onOpen}
        className={cn(
          "relative grid size-10 cursor-pointer place-items-center rounded-by-lg hover:bg-by-sunken",
          active && "bg-by-sunken",
          LIFT,
          FOCUS_RING,
          className,
        )}
        {...props}
      >
        <svg viewBox="0 0 28 28" aria-hidden="true" className="size-7">
          <circle cx="14" cy="14" r={R} fill="none" strokeWidth="3.5" className="stroke-by-line" />
          <circle
            cx="14" cy="14" r={R} fill="none" strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 14 14)"
            className="stroke-by-accent transition-[stroke-dasharray] duration-(--by-dur-enter) ease-by-out motion-reduce:transition-none"
          />
        </svg>
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-by-body text-[9.5px] font-bold tabular-nums text-by-text">{pct}</span>
      </button>
    </Tooltip>
  );
}
