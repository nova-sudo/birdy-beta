"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Circle, Pencil } from "lucide-react";
import { cn } from "@/components/by";

/**
 * "What <agent> knows": one line per interview step. A done line opens its
 * form to change the answer. On a wide screen it is a column on the right; on
 * a phone it folds into a bar over the chat.
 *
 * @param {string} props.name the agent's name
 * @param {{step: string, label: string, value: string|null, done: boolean, current: boolean}[]} props.lines
 * @param {(step: string) => void} props.onEdit
 */
export function KnowsPanel({ name, lines, onEdit }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const done = lines.filter((l) => l.done).length;
  return (
    <aside
      aria-labelledby={`${listId}-title`}
      className="order-first shrink-0 border-b border-by-line bg-by-surface lg:order-last lg:flex lg:w-72 lg:flex-col lg:border-b-0 lg:border-l"
    >
      <div className="flex items-center gap-2 px-4 py-3 lg:block lg:px-5 lg:pt-5 lg:pb-2">
        <div className="min-w-0 flex-1">
          <h2 id={`${listId}-title`} className="font-by-display text-by-body-lg font-semibold text-by-text">What {name} knows</h2>
          <p className="text-by-body-sm text-by-muted">
            <span className="lg:hidden">{done} of {lines.length} answered · </span>Click a line to change it.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={open ? "Hide what it knows" : "Show what it knows"}
          onClick={() => setOpen(!open)}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-by-md text-by-text-2 hover:bg-by-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent lg:hidden"
        >
          <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform duration-(--by-dur-fast) ease-by-out", open && "rotate-180")} />
        </button>
      </div>
      <ul id={listId} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 lg:block lg:px-5", open ? "block max-h-72" : "hidden")}>
        {lines.map((l) => {
          const body = (
            <>
              {l.done
                ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-by-success" strokeWidth={2.5} />
                : <Circle aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", l.current ? "text-by-accent" : "text-by-line-strong")} />}
              <span className="min-w-0 flex-1">
                <b className="block font-semibold text-by-text">{l.label}</b>
                <span className={cn("block", l.done ? "text-by-muted" : l.current ? "text-by-accent" : "text-by-muted")}>
                  {l.done ? l.value ?? "Answered" : l.current ? "Asking now" : "Still to ask"}
                </span>
              </span>
              {l.done && <Pencil aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-by-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />}
            </>
          );
          return (
            <li key={l.step} className="border-b border-by-line last:border-b-0">
              {l.done ? (
                <button
                  type="button"
                  onClick={() => onEdit(l.step)}
                  aria-label={`Change ${l.label}: ${l.value ?? "answered"}`}
                  className="group -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-start gap-2.5 rounded-by-md px-2 py-2.5 text-left text-by-body-sm hover:bg-by-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent"
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-start gap-2.5 py-2.5 text-by-body-sm">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
