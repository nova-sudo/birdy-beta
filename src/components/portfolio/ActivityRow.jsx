import { cn } from "@/lib/utils";

// "Auto-run" is Birdy acting under standing approval; "Approved" is a change
// the user signed off. The distinction is the point of the feed — an owner
// needs to see at a glance what happened without them.
const MODES = {
  "Auto-run": { glyph: "⚡", className: "bg-pd-primary-tint text-pd-primary" },
  Approved: { glyph: "✓", className: "bg-pd-success-bg text-pd-success" },
};

/** @param {{action, client, mode, time}} entry */
export function ActivityRow({ entry }) {
  const mode = MODES[entry.mode] ?? MODES.Approved;

  return (
    <li className="mb-[15px] flex gap-[11px]">
      <span
        className={cn(
          "flex size-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
          mode.className
        )}
        aria-hidden="true"
      >
        {mode.glyph}
      </span>
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold leading-[1.35] text-pd-ink">{entry.action}</div>
        {entry.client && <div className="mt-0.5 text-[11.5px] text-pd-subtle">{entry.client}</div>}
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={cn("rounded-[5px] px-[7px] py-0.5 text-[10.5px] font-bold", mode.className)}
          >
            {entry.mode}
          </span>
          <span className="text-[11px] text-pd-faint">{entry.time}</span>
        </div>
      </div>
    </li>
  );
}
