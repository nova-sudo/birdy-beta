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

/** Counts from zero to `target` once, when the component first appears. */
function useCountUp(target, enabled) {
  const [shown, setShown] = useState(target);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || !enabled || !Number.isFinite(target)) return;
    ran.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    const duration = 700;
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setShown(target);
    };
    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);
  return shown;
}

/**
 * One headline figure with its change beside it.
 *
 * @param {string} props.label
 * @param {number} props.value
 * @param {(n: number) => string} [props.format] turns the number into text, e.g. money; whole numbers by default
 * @param {React.ReactNode} [props.delta] usually a Delta
 * @param {boolean} [props.countUp] count up from zero once on first appearance; on by default
 */
export function KpiTile({ label, value, format = (n) => Math.round(n).toLocaleString("en-GB"), delta, countUp = true, className, ...props }) {
  const shown = useCountUp(value, countUp);
  return (
    <Card className={cn("px-4 py-3.5", className)} {...props}>
      <div className="text-by-body-sm text-by-text-2">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        {/* Screen readers get the final figure, not the counting. */}
        <span className="font-by-display text-by-title font-semibold tabular-nums text-by-text" aria-label={format(value)}>
          <span aria-hidden="true">{format(shown)}</span>
        </span>
        {delta}
      </div>
    </Card>
  );
}
