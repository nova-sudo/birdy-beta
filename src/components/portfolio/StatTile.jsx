import { cn } from "@/lib/utils";
import { DeltaPill } from "./DeltaPill";
import { toneClass } from "./tones";

// A stat is always the same four things — an icon chip, a value, a label and a
// delta — so the KPI strip and the call-insight cells are one component. They
// differ in arrangement, not in concept: the strip runs horizontally with the
// pill pushed to the end, the cell stacks chip-and-pill over value-over-label.
const LAYOUTS = {
  strip: {
    root: "flex flex-1 items-center gap-[13px] px-5 py-4",
    chip: "size-9 rounded-[10px]",
    icon: "size-[17px]",
    value: "text-[22px]",
    label: "mt-1 text-[12px] text-pd-subtle",
    pillSize: "md",
  },
  cell: {
    root: "min-w-0 flex-1 rounded-xl border border-pd-border px-[14px] py-[13px]",
    chip: "size-7 rounded-lg",
    icon: "size-[14px]",
    value: "text-[20px]",
    label: "mt-[5px] truncate text-[11.5px] text-pd-subtle",
    pillSize: "sm",
  },
};

/**
 * @param {React.ElementType} icon lucide component
 * @param {string} tone key into TONES — names the metric's colour family
 * @param {"up"|"down"} [direction] omit to render no delta at all
 * @param {string} [polarity] whether up or down counts as an improvement
 */
export function StatTile({
  icon: Icon,
  tone,
  value,
  label,
  direction,
  delta,
  polarity,
  layout = "strip",
  className,
}) {
  const l = LAYOUTS[layout];

  // A metric with no comparable prior period renders without a pill rather
  // than with a zero — an unknown delta is not a flat one.
  const pill = direction ? (
    <DeltaPill
      size={l.pillSize}
      direction={direction}
      value={delta}
      polarity={polarity}
      className={layout === "strip" ? "ml-auto" : "ml-auto"}
    />
  ) : null;

  const chip = (
    <span className={cn("flex shrink-0 items-center justify-center", l.chip, toneClass(tone))}>
      <Icon className={l.icon} aria-hidden="true" />
    </span>
  );

  if (layout === "cell") {
    return (
      <div className={cn(l.root, className)}>
        <div className="mb-2.5 flex items-center gap-2">
          {chip}
          {pill}
        </div>
        <div className={cn("font-pd-display font-bold leading-none text-pd-ink", l.value)}>
          {value}
        </div>
        <div className={l.label}>{label}</div>
      </div>
    );
  }

  return (
    <div className={cn(l.root, className)}>
      {chip}
      <div className="min-w-0">
        <div className={cn("font-pd-display font-bold leading-none text-pd-ink", l.value)}>
          {value}
        </div>
        <div className={l.label}>{label}</div>
      </div>
      {pill}
    </div>
  );
}
