"use client";

import { Check, ChevronDown, Minus } from "lucide-react";
import { Button, Card, cn } from "@/components/by";
import { STEPS, pctDone, stepsLeft } from "@/lib/setup-steps";

const LABEL = { done: "Done", setup: "In setup", issue: "Issue", todo: "To do", now: "Now" };
const TONE = {
  done: "bg-by-success-bg text-by-success",
  setup: "bg-by-accent-soft text-by-accent",
  issue: "bg-by-danger-bg text-by-danger",
  todo: "bg-by-sunken text-by-text-2",
  now: "bg-by-accent-soft text-by-accent",
};

/** The thin bar the checklist folds to. */
function Track({ pct, big = false }) {
  return (
    <span aria-hidden="true" className={cn("block overflow-hidden rounded-full bg-by-sunken", big ? "h-1.5" : "h-1")}>
      <i className="block h-full rounded-full bg-by-accent transition-[width] duration-(--by-dur-enter) ease-by-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * The setup checklist: "% done", then one row per step as Done, In setup,
 * Issue or To do. A row jumps to its step. Folds to a thin progress bar.
 *
 * @param {Record<string, string>} props.steps from deriveSteps
 * @param {(id: string) => void} [props.onJump] without it the rows are a plain list
 * @param {boolean} [props.folded]
 * @param {(folded: boolean) => void} [props.onFold] without it the checklist doesn't fold
 * @param {string} [props.current] the step on screen, marked Now
 * @param {boolean} [props.flat] no card around it, for a side column
 */
export function Checklist({ steps, onJump, folded = false, onFold, current, flat = false }) {
  const pct = pctDone(steps);
  const left = stepsLeft(steps);
  if (folded) {
    return (
      <button
        type="button"
        onClick={() => onFold(false)}
        aria-label={`Setup ${pct}% done. Show the checklist`}
        className="sticky top-0 z-10 flex w-full cursor-pointer items-center gap-3 rounded-by-lg border border-by-line bg-by-surface px-3.5 py-2.5 text-left shadow-by-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent"
      >
        <span className="shrink-0 text-by-body-sm text-by-text-2">Setup <b className="text-by-text">{pct}%</b></span>
        <span className="flex-1"><Track pct={pct} /></span>
        <span className="inline-flex shrink-0 items-center gap-1 text-by-body-sm font-semibold text-by-accent">Show<ChevronDown aria-hidden="true" className="size-3.5" /></span>
      </button>
    );
  }
  return (
    <Card role="region" aria-labelledby="setup-checklist-title" className={flat ? "border-0 bg-transparent shadow-none" : "px-5 pt-4.5 pb-2"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="setup-checklist-title" className="font-by-display text-by-heading font-semibold text-by-text">Set up Birdy</h2>
          <p className="mt-0.5 text-by-body-sm text-by-muted">
            {pct === 0 ? `${STEPS.length} steps, about ten minutes.` : left === 0 ? "All done." : `${pct}% done · ${left} to go`}
          </p>
        </div>
        {onFold && <Button kind="ghost" size="sm" iconOnly aria-label="Fold the checklist" onClick={() => onFold(true)}><Minus aria-hidden="true" /></Button>}
      </div>
      <div className="mt-3 mb-1"><Track pct={pct} big /></div>
      <ol className="flex flex-col">
        {STEPS.map((step, i) => {
          const now = step.id === current;
          const state = now && steps[step.id] !== "done" ? "now" : steps[step.id];
          const Row = onJump ? "button" : "div";
          return (
            <li key={step.id} className="border-t border-by-line-soft first:border-t-0" aria-current={now ? "step" : undefined}>
              <Row
                {...(onJump ? { type: "button", onClick: () => onJump(step.id) } : {})}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-by-md px-1.5 py-2 text-left",
                  onJump && "cursor-pointer transition-colors duration-(--by-dur-fast) ease-by-out hover:bg-by-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent",
                  now && "bg-by-accent-soft hover:bg-by-accent-soft",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-by-caption font-semibold",
                    state === "done" ? "bg-by-success-solid text-by-on-accent" : state === "issue" ? "bg-by-danger-solid text-by-on-accent"
                      : state === "now" ? "border-[1.5px] border-by-accent bg-by-surface text-by-accent" : "bg-by-sunken text-by-text-2",
                  )}
                >
                  {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : state === "issue" ? "!" : i + 1}
                </span>
                <span className={cn("min-w-0 flex-1 text-by-body text-by-text", now && "font-semibold")}>{step.label}</span>
                <span className={cn("shrink-0 rounded-by-sm px-2 py-0.5 text-by-caption font-semibold", TONE[state])}>{LABEL[state]}</span>
              </Row>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
