"use client";

import { useId } from "react";
import { AlertCircle, Check, ChevronDown, Circle, CircleDot } from "lucide-react";
import { cn } from "@/components/by";
import { STEPS, nextStep, pctDone, stepsLeft } from "@/lib/setup-steps";

/** The thin progress bar under the title. */
function Track({ pct }) {
  return (
    <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-by-sunken">
      <i className="block h-full rounded-full bg-by-accent transition-[width] duration-(--by-dur-enter) ease-by-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </span>
  );
}

/** A step's line under its label. */
const STATUS = { done: "Done", now: "Now", issue: "Needs attention", setup: "Started", todo: "To do" };

/**
 * "Set up Birdy": Agency Ops' nine steps in a quiet column beside its setup
 * chat, the way an interview shows what its agent knows. Each row is Done,
 * Now or To do; a done row, or the one being done, scrolls the chat to it.
 * On a wide screen it's a column on the right; on a phone it folds into a bar
 * over the chat that says how far along setup is.
 *
 * @param {Record<string, string>} props.steps from deriveSteps
 * @param {(id: string) => void} [props.onJump] scrolls the chat to a step
 * @param {boolean} [props.open] unfolded on a phone (the rail's ring asks for this)
 * @param {(open: boolean) => void} [props.onOpenChange]
 */
export function Checklist({ steps, onJump, open = false, onOpenChange }) {
  const listId = useId();
  const pct = pctDone(steps);
  const left = stepsLeft(steps);
  const current = nextStep(steps);
  const progress = pct === 0 ? `${STEPS.length} steps, about ten minutes` : left === 0 ? "All done" : `${pct}% done · ${left} to go`;
  return (
    <aside
      aria-labelledby={`${listId}-title`}
      className="order-first shrink-0 border-b border-by-line bg-by-surface lg:order-last lg:flex lg:w-72 lg:flex-col lg:border-b-0 lg:border-l"
    >
      <div className="flex items-center gap-2 px-4 py-3 lg:block lg:px-5 lg:pt-5 lg:pb-3">
        <div className="min-w-0 flex-1">
          <h2 id={`${listId}-title`} className="font-by-display text-by-body-lg font-semibold text-by-text">Set up Birdy</h2>
          <p className="text-by-body-sm text-by-muted">{progress}<span className="hidden lg:inline">. Click a done step to see it in the chat.</span></p>
          <div className="mt-2.5 hidden lg:block"><Track pct={pct} /></div>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={open ? "Hide the setup steps" : "Show the setup steps"}
          onClick={() => onOpenChange?.(!open)}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-by-md text-by-text-2 hover:bg-by-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent lg:hidden"
        >
          <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform duration-(--by-dur-fast) ease-by-out", open && "rotate-180")} />
        </button>
      </div>
      <ol id={listId} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 lg:block lg:px-5", open ? "block max-h-72" : "hidden")}>
        {STEPS.map((step) => {
          const now = step.id === current;
          const state = steps[step.id] === "done" ? "done" : now ? "now" : steps[step.id] === "issue" ? "issue" : steps[step.id] === "setup" ? "setup" : "todo";
          const body = (
            <>
              {state === "done" ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-by-success" strokeWidth={2.5} />
                : state === "now" ? <CircleDot aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-by-accent" />
                  : state === "issue" ? <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-by-danger" />
                    : <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-by-line-strong" />}
              <span className="min-w-0 flex-1">
                <b className={cn("block font-semibold", state === "todo" || state === "setup" ? "text-by-text-2" : "text-by-text")}>{step.label}</b>
                <span className={cn("block", state === "now" ? "text-by-accent" : state === "issue" ? "text-by-danger" : "text-by-muted")}>{STATUS[state]}</span>
              </span>
            </>
          );
          const jumpable = onJump && (state === "done" || state === "now");
          return (
            <li key={step.id} className="border-b border-by-line last:border-b-0" aria-current={now ? "step" : undefined}>
              {jumpable ? (
                <button
                  type="button"
                  onClick={() => onJump(step.id)}
                  className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-start gap-2.5 rounded-by-md px-2 py-2.5 text-left text-by-body-sm hover:bg-by-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent"
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-start gap-2.5 py-2.5 text-by-body-sm">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
