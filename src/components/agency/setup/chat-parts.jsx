"use client";

import { Check, Loader2, RotateCcw } from "lucide-react";
import { Button, ChatSender, UserMessage, cn } from "@/components/by";
import { ToolLogo } from "./tool-logo";

const ENTER = "motion-safe:animate-[by-enter_var(--by-dur-base)_var(--by-ease-out)]";

/**
 * One of the agent's turns in a setup chat: what it says (`Say`), then any
 * controls (chips, a form, connect cards) under it, outside the bubble so a
 * card never sits inside a card. The sender line shows on the first turn of a
 * run: the chat's first message, any turn right after the person's reply, or
 * when `first` is passed. Turns and replies are siblings in the chat column,
 * which is what the selectors below rely on. `id` is what the checklist
 * scrolls to.
 */
export function Bubble({ name, first = false, id, className, children }) {
  return (
    <div id={id} data-turn="" className={cn("flex scroll-mt-6 flex-col gap-1.5", ENTER, className)}>
      <ChatSender
        name={name}
        className={cn(first ? "flex" : "hidden", "[[data-reply]+[data-turn]>&]:flex [[data-turn]:first-child>&]:flex")}
      />
      <div className="flex flex-col gap-2.5 text-by-body-lg text-by-text sm:pl-10">{children}</div>
    </div>
  );
}

/** What the agent says: a white bubble with the kit's card border, so its words stand out from the page. */
export function Say({ children, className }) {
  return (
    <p className={cn("w-fit max-w-2xl rounded-by-xl rounded-tl-by-sm border border-by-line bg-by-surface px-4 py-2.5 font-medium leading-relaxed text-by-text shadow-by-card", className)}>
      {children}
    </p>
  );
}

/** The person's answer, on the right. */
export const Reply = ({ children }) => <UserMessage data-reply="">{children}</UserMessage>;

/** A heading-weight first line inside a bubble. */
export const Lead = ({ children }) => <span className="block font-by-display text-by-heading font-semibold">{children}</span>;

/**
 * Quick replies instead of a form.
 * @param {string[]} props.items
 * @param {(item: string) => void} props.onPick
 * @param {string} [props.recommended] marked "Recommended"
 * @param {string} [props.busy] the item being saved; all are blocked meanwhile
 */
export function Chips({ items, onPick, recommended, busy, label }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Button key={item} className="rounded-full font-medium" loading={busy === item} disabled={Boolean(busy) && busy !== item} onClick={() => onPick(item)}>
          {item}
          {item === recommended && <span className="rounded-by-sm bg-by-accent-soft px-1.5 py-0.5 text-by-caption font-semibold text-by-accent">Recommended</span>}
        </Button>
      ))}
    </div>
  );
}

/**
 * A tool to connect, in the chat: Connect, Connecting…, Connected, or what went wrong and Retry.
 * @param {"meta"|"ghl"|"hp"|"slack"} props.tool whose logo leads the card
 * @param {"todo"|"connecting"|"done"|"error"|"issue"} props.state `issue`: connected once, needs connecting again
 * @param {string} [props.problem] says what went wrong in the error and issue states
 */
export function ConnectCard({ tool, name, what, state, problem, onConnect, connectLabel = "Connect", children }) {
  const bad = state === "error" || state === "issue";
  return (
    <div className={cn("rounded-by-lg border bg-by-surface p-3.5 shadow-by-card", bad ? "border-by-danger" : "border-by-line")}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-by-md border border-by-line-soft bg-by-surface">
          <ToolLogo tool={tool} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block font-semibold text-by-text">{name}</b>
          <span className={cn("block text-by-body-sm", bad ? "text-by-danger" : "text-by-muted")}>{bad && problem ? problem : what}</span>
        </span>
        {state === "done" ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-by-body-sm font-semibold text-by-success"><Check aria-hidden="true" className="size-4" strokeWidth={2.5} />Connected</span>
        ) : state === "connecting" ? (
          <span role="status" className="inline-flex shrink-0 items-center gap-1.5 text-by-body-sm font-semibold text-by-accent"><Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />Connecting…</span>
        ) : onConnect ? (
          <Button kind={bad ? "secondary" : "primary"} size="sm" className="shrink-0" onClick={onConnect} aria-label={`${bad ? "Retry" : connectLabel} ${name}`}>
            {bad ? <><RotateCcw aria-hidden="true" />Retry</> : connectLabel}
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
