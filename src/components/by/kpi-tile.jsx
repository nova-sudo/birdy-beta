"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";
import { Card } from "./card";

const TONE = { good: "text-by-success", bad: "text-by-danger", flat: "text-by-muted" };

/**
 * A change against the previous period.
 *
 * Colour follows whether the change is good, not which way it points: a
 * falling cost per lead is green.
 *
 * @param {number} props.value signed percentage, e.g. -3.0
 * @param {"up"|"down"|"neither"} [props.goodWhen] which direction is good for this metric
 */
export function Delta({ value, goodWhen = "neither", className, ...props }) {
  const down = value < 0;
  const flat = value === 0 || goodWhen === "neither";
  const tone = flat ? "flat" : (down ? goodWhen === "down" : goodWhen === "up") ? "good" : "bad";
  const text = `${Math.abs(value).toFixed(1)}%`;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap font-by-body text-by-caption font-semibold tabular-nums", TONE[tone], className)} {...props}>
      {value !== 0 && (
        <svg aria-hidden="true" viewBox="0 0 10 10" className={cn("size-2 shrink-0", !down && "rotate-180")}>
          <path d="M1 2.5h8L5 8.5z" fill="currentColor" />
        </svg>
      )}
      <span className="sr-only">{value === 0 ? "No change" : down ? "Down" : "Up"}</span>
      {text}
    </span>
  );
}

/** Counts from zero to `target` once, the first time there is a figure to show. After that it follows `target` directly. */
function useCountUp(target, enabled) {
  const [shown, setShown] = useState(target);
  const done = useRef(false);
  useEffect(() => {
    const still = done.current || !enabled || !Number.isFinite(target) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      setShown(target);
      return;
    }
    const start = performance.now();
    const duration = 700;
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
      else done.current = true;
    };
    setShown(0);
    frame = requestAnimationFrame(tick);
    // Only a finished count marks it done, so an interrupted one (a re-render, a changed figure) starts again instead of freezing.
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);
  return shown;
}

/**
 * One headline figure with its change beside it.
 *
 * @param {string} props.label
 * @param {number|null} props.value a missing figure (null) shows as a dash
 * @param {(n: number) => string} [props.format] turns the number into text, e.g. money; whole numbers by default
 * @param {React.ReactNode} [props.delta] usually a Delta
 * @param {React.ReactNode} [props.note] one line under the figure, e.g. "vs previous 7 days"
 * @param {"md"|"lg"} [props.size] "lg" is the page-leading tile: 24px padding and the display figure, 140px tall with a note
 * @param {boolean} [props.countUp] count up from zero once on first appearance; on by default
 */
export function KpiTile({ label, value, format = (n) => Math.round(n).toLocaleString("en-GB"), delta, note, size = "md", countUp = true, className, ...props }) {
  const lg = size === "lg";
  const figure = lg ? "font-by-display text-by-display leading-[1.1] font-semibold tracking-[-0.01em]" : "font-by-display text-by-title font-semibold";
  const known = Number.isFinite(value);
  const shown = useCountUp(known ? value : 0, countUp && known);
  return (
    <Card className={cn(lg ? "p-6" : "px-4 py-3.5", className)} {...props}>
      <div className={cn("text-by-body-sm text-by-text-2", lg && "font-medium")}>{label}</div>
      <div className={cn("flex items-baseline gap-2", lg ? "mt-2" : "mt-1")}>
        {/* Screen readers get the final figure, not the counting. */}
        {known ? (
          <span className={cn(figure, "tabular-nums text-by-text")} aria-label={format(value)}>
            <span aria-hidden="true">{format(shown)}</span>
          </span>
        ) : (
          <span className={cn(figure, "text-by-muted")} aria-label="No data">—</span>
        )}
        {known && delta}
      </div>
      {note && <div className={cn("text-by-body-sm text-by-text-2", lg ? "mt-2 font-medium" : "mt-1")}>{note}</div>}
    </Card>
  );
}
