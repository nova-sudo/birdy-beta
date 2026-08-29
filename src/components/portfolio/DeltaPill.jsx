import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { deltaTone, HIGHER_IS_BETTER } from "@/lib/portfolio-metrics";

// Arrow + figure on a tinted pill. Two sizes: `md` on the KPI strip, `sm` in
// the call-insights cells.
const SIZES = {
  md: { pill: "gap-[5px] rounded-lg px-[9px] py-[5px] text-[12px]", arrow: "size-3" },
  sm: { pill: "gap-1 rounded-[7px] px-[7px] py-1 text-[10.5px]", arrow: "size-[11px]" },
};

/**
 * @param {"up"|"down"} direction which way the number moved
 * @param {string} value the figure itself — "8.4%", "3.1pts", "1m06", "0.2"
 * @param {string} polarity whether up or down counts as an improvement
 */
export function DeltaPill({ direction, value, polarity = HIGHER_IS_BETTER, size = "md", className }) {
  const s = SIZES[size];
  const tone = deltaTone(direction, polarity);
  const Arrow = direction === "up" ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn("flex shrink-0 items-center font-bold", s.pill, tone.text, tone.bg, className)}
    >
      <Arrow className={cn(s.arrow, "shrink-0")} strokeWidth={3} aria-hidden="true" />
      {/* The arrow is the only thing carrying direction visually. */}
      <span className="sr-only">{direction} </span>
      {value}
    </span>
  );
}
