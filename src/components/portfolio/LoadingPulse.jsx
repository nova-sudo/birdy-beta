"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A waiting state that says what is being waited on.
 *
 * A grey rectangle tells you nothing; these panels can take a few seconds
 * because the funnel sums a cohort across every client and the chart counts
 * leads day by day, so the statements name the step and the bar shows that
 * something is still moving.
 *
 * **The bar is an activity indicator, not a measurement.** No endpoint here
 * reports progress, so it eases towards a ceiling it never reaches and only
 * completes by unmounting when the data lands. It is deliberately capped below
 * full so it never sits at 100% claiming to be finished while the panel waits.
 *
 * Under `prefers-reduced-motion` the statements stop rotating and the bar stops
 * creeping — the first statement stays put and the bar holds one width.
 *
 * @param {string[]} statements cycled in order, then held on the last one
 * @param {number} [interval] ms per statement
 */
export function LoadingPulse({ statements, className, interval = 2200 }) {
  const [step, setStep] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    // Hold on the closing statement rather than looping back to the top —
    // a cycling list reads as "stuck", a settling one reads as "nearly there".
    if (step >= statements.length - 1) return;

    const id = setTimeout(() => setStep((s) => s + 1), interval);
    return () => clearTimeout(id);
  }, [step, statements.length, interval, reduced]);

  // Each statement advances the bar by a shrinking amount, so it slows as it
  // goes and tops out at CEILING however long the wait runs.
  const CEILING = 92;
  const progress = reduced
    ? CEILING / 2
    : CEILING * (1 - Math.pow(0.55, step + 1));

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[16px] border border-pd-border bg-pd-surface px-6",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <p
        key={step}
        className="motion-safe:animate-in motion-safe:fade-in text-[13px] text-pd-body motion-safe:duration-500"
      >
        {statements[Math.min(step, statements.length - 1)]}
      </p>

      <div
        className="mt-3 h-[5px] w-[min(260px,70%)] overflow-hidden rounded-full bg-pd-divider"
        // The bar mirrors the statements, which are already announced above.
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-pd-primary transition-[width] duration-[1200ms] ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/** True when the viewer has asked the OS for less animation. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // jsdom and older browsers have no matchMedia. Absent the query we can't
    // know the preference, and animating is the safer default to fall back on
    // than freezing the panel.
    if (typeof window.matchMedia !== "function") return;

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (e) => setReduced(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/** What the funnel is doing while you wait. */
export const FUNNEL_LOADING = [
  "Gathering this window's leads…",
  "Matching them to CRM opportunities…",
  "Checking which ones were called…",
  "Working out the close rate…",
];

/** What the trend chart is doing while you wait. */
export const CHART_LOADING = [
  "Counting leads day by day…",
  "Finding which ones closed…",
  "Bucketing them into the range…",
  "Drawing the curve…",
];

export const CALL_CHART_LOADING = [
  "Pulling call logs for the window…",
  "Sorting inbound from outbound…",
  "Bucketing them into the range…",
  "Drawing the curve…",
];
