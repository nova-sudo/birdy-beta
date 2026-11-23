"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMemo } from "react";
import { BirdyAvatar, Button, cn } from "@/components/by";

// Confetti colours: the three agents' own colours and Birdy's purple.
const COLOURS = ["bg-by-accent", "bg-by-buyer", "bg-by-coach", "bg-by-clients", "bg-by-ops"];
const PIECES = 36;

/**
 * Confetti falling once behind a celebration. Decorative, and left out for
 * people who ask for less motion. The pieces are worked out from their index,
 * so the server and the browser draw the same ones.
 */
function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: PIECES }, (_, i) => ({
      left: `${(i * 37 + 11) % 100}%`,
      delay: `${(i % 9) * 90}ms`,
      duration: `${2200 + ((i * 53) % 1400)}ms`,
      drift: `${((i * 29) % 160) - 80}px`,
      spin: `${360 + ((i * 97) % 720)}deg`,
      colour: COLOURS[i % COLOURS.length],
      wide: i % 3 === 0,
    })),
    [],
  );
  return (
    <div aria-hidden="true" data-confetti="" className="pointer-events-none fixed inset-0 z-50 overflow-hidden motion-reduce:hidden">
      {pieces.map((p, i) => (
        <i
          key={i}
          className={cn("absolute top-0 block rounded-[2px] opacity-0", p.wide ? "h-2 w-3.5" : "size-2", p.colour)}
          style={{ left: p.left, animation: `by-confetti ${p.duration} var(--by-ease-out) ${p.delay} 1 both`, "--by-drift": p.drift, "--by-spin": p.spin }}
        />
      ))}
    </div>
  );
}

/**
 * The moment an agent is set up: a dialog over the setup chat with confetti,
 * what was just finished, and the way on.
 *
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange closing it leaves the chat as it is, with the same buttons under it
 * @param {string} props.title e.g. "Agency Ops is set up"
 * @param {React.ReactNode} [props.children] one or two lines on what that means and what comes next
 * @param {React.ReactNode} [props.icon] the agent's own tile; Birdy in its round frame when left out
 * @param {string[]} [props.done] short lines of what is now in place, shown with ticks
 * @param {{label: React.ReactNode, onClick: () => void, loading?: boolean, disabled?: boolean}} [props.primary] the next step
 * @param {{label: React.ReactNode, onClick: () => void, loading?: boolean, disabled?: boolean}} [props.secondary]
 */
export function SetupCelebration({ open, onOpenChange, title, children, icon, done = [], primary, secondary }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-by-text/30 motion-safe:animate-[by-fade_var(--by-dur-fast)_var(--by-ease-out)]" />
        <Confetti />
        <DialogPrimitive.Content
          {...(children ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4",
            "rounded-by-xl bg-by-surface px-7 pt-8 pb-6 text-center font-by-body text-by-body text-by-text shadow-by-dialog outline-none",
            "motion-safe:animate-[by-dialog_var(--by-dur-base)_var(--by-ease-spring)]",
          )}
        >
          {icon ?? <BirdyAvatar size={64} />}
          <div className="flex flex-col gap-1.5">
            <DialogPrimitive.Title className="font-by-display text-by-title font-bold tracking-[-0.01em] text-balance">{title}</DialogPrimitive.Title>
            {children && <DialogPrimitive.Description asChild><div className="text-by-body-lg text-by-text-2 text-pretty">{children}</div></DialogPrimitive.Description>}
          </div>
          {done.length > 0 && (
            <ul className="flex w-full flex-col gap-1.5 rounded-by-lg bg-by-sunken px-4 py-3 text-left text-by-body">
              {done.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-by-success-solid text-[10px] font-bold text-by-on-accent">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1 flex w-full flex-col gap-2">
            {primary && <Button kind="primary" className="w-full justify-center" loading={primary.loading} disabled={primary.disabled} onClick={primary.onClick}>{primary.label}</Button>}
            {secondary && <Button kind="ghost" className="w-full justify-center" loading={secondary.loading} disabled={secondary.disabled} onClick={secondary.onClick}>{secondary.label}</Button>}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
