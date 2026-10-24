"use client"

// Shared primitives for the first-run onboarding wizard. Everything here is
// presentational; state lives in page.jsx. The wizard is a full-screen frame
// (top bar, scrolling body, pinned footer) built from ds components and token
// utilities, following Paper's onboarding flow.

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Search } from "lucide-react"
import { Button, Input, ProgressBar } from "@/components/ds"
import { SLACK_PREVIEW_VARS } from "@/lib/brand-colors"
import { cn } from "@/lib/utils"

/**
 * The content column widths the wizard's steps use. Every step is a prose
 * column (heading, a line of copy, one control), a wide one (a table, a
 * scrollable list) or, for the report copilot, the full designer. They live
 * here rather than being repeated per step so the column can be tuned in one
 * place. Text in all of them is left-aligned; only the welcome and completion
 * hero steps centre theirs.
 */
export const STEP_COL = "w-full max-w-[560px]"
export const STEP_COL_WIDE = "w-full max-w-[720px]"
export const STEP_COL_FULL = "w-full max-w-[1120px]"

/**
 * The footer's right-hand slot. page.jsx renders an empty node for it and
 * provides that node here; a step renders <WizardFooter> wherever it likes and
 * its actions are portaled into the pinned footer, so the step keeps owning
 * its handlers while the frame owns the layout.
 */
export const WizardFooterContext = createContext(null)

/**
 * @param {object} props
 * @param {{label: string, onClick: () => void, disabled?: boolean, loading?: boolean}} [props.primary]
 * @param {React.ReactNode} [props.secondary] Rendered to the left of the primary button
 */
export function WizardFooter({ primary, secondary }) {
  const node = useContext(WizardFooterContext)
  if (!node) return null
  // shrink-0 on the buttons and min-w-0 on the slot (page.jsx) keep the row
  // from overflowing at 390; a step with a long secondary label should shorten
  // it below sm instead (see ReportCopilotStep).
  return createPortal(
    <>
      {secondary}
      {primary && (
        <Button
          variant="primary"
          size="lg"
          className="shrink-0"
          onClick={primary.onClick}
          disabled={primary.disabled}
          loading={primary.loading}
        >
          {primary.label}
        </Button>
      )}
    </>,
    node
  )
}

/** Step head: an optional eyebrow, the title, an optional description. */
export function StepHeading({ eyebrow, description, children, className }) {
  return (
    <div className={cn("mb-8 flex flex-col gap-2", className)}>
      {eyebrow && <div className="text-xs font-medium text-primary">{eyebrow}</div>}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{children}</h1>
      {description && <p className="text-base text-muted-foreground">{description}</p>}
    </div>
  )
}

/** Large (44px) ds Input for the wizard's text steps. */
export function StepInput({ className, ...props }) {
  return <Input className={cn("h-control-lg text-base", className)} {...props} />
}

/** Text input with a leading search icon. */
export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative mb-3.5">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input value={value} onChange={onChange} placeholder={placeholder} className="pl-9" />
    </div>
  )
}

/**
 * Progress for work whose duration we cannot measure — a GHL sub-account list
 * that takes as long as the agency is large, the first client's historical
 * pull, the bulk import. There is no percentage to report, but a bare spinner
 * on a 30-second wait reads as "stuck" and people reload, which is worse than
 * slow.
 *
 * So the bar advances on a decaying curve: fast at first, asymptotically
 * approaching `ceiling` and never reaching it. It is honest about direction
 * (something is happening) without claiming a completion time it cannot know,
 * and it structurally cannot hit 100% while the work is still running —
 * `done` is the only thing that finishes it.
 *
 * `expectedMs` is the half-life, not a deadline: roughly how long the work
 * usually takes. Overshooting it just means the curve flattens rather than
 * the bar lying.
 */
export function useFakeProgress(active, { expectedMs = 12000, ceiling = 92, done = false } = {}) {
  const [pct, setPct] = useState(0)
  const startedAt = useRef(null)

  useEffect(() => {
    if (done) {
      setPct(100)
      return
    }
    if (!active) {
      setPct(0)
      startedAt.current = null
      return
    }
    startedAt.current = Date.now()
    setPct(0)
    const tick = () => {
      const elapsed = Date.now() - (startedAt.current || Date.now())
      // 1 - 0.5^(t/half-life): 50% at expectedMs, 75% at double, never 100%.
      setPct(ceiling * (1 - Math.pow(0.5, elapsed / expectedMs)))
    }
    tick()
    const timer = setInterval(tick, 400)
    return () => clearInterval(timer)
  }, [active, done, expectedMs, ceiling])

  return pct
}

/** `useFakeProgress` wired straight into a `ProgressBar`, with an optional caption. */
export function FakeProgressBar({ active = true, done = false, expectedMs, caption, className = "" }) {
  const pct = useFakeProgress(active, { expectedMs, done })
  return (
    <div className={className}>
      <ProgressBar value={pct} tone="primary" label="Working" />
      {caption && <div className="mt-2 text-center text-xs text-muted-foreground">{caption}</div>}
    </div>
  )
}

/**
 * One line at a time from `messages`, swapped every `everyMs`.
 *
 * A progress bar answers "is this moving"; it does not answer "what is it
 * doing", and on the longest wait in the wizard that second question is the
 * one people actually have. A screen that says the same sentence for ninety
 * seconds reads as frozen even while the bar creeps, so the copy moves too.
 *
 * It stops on the last line rather than looping back to the first. Cycling
 * round is a tell that the messages are decorative — once someone sees line
 * one come back they stop reading all of them, and the honest signal that
 * this is taking longer than usual is the line that stays put.
 */
export function CyclingCaption({ messages = [], everyMs = 3200, className = "" }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    if (messages.length <= 1) return
    const timer = setInterval(
      () => setIndex((i) => (i < messages.length - 1 ? i + 1 : i)),
      everyMs
    )
    return () => clearInterval(timer)
    // Joined rather than passed by reference: an inline array literal is a new
    // object on every render and would restart the cycle on each one.
  }, [messages.join("|"), everyMs])

  if (!messages.length) return null
  return (
    <div
      // Keyed so each line fades in as its own element rather than the text
      // changing under a static node.
      key={index}
      className={cn("animate-in fade-in duration-500 text-center text-xs text-muted-foreground", className)}
    >
      {messages[index]}
    </div>
  )
}

/** Green check circle + label ("GHL connected", "Targets applied"…). */
export function SuccessRow({ children }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded-full bg-success-soft text-success-ink">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
      <span className="text-sm font-semibold text-success-ink">{children}</span>
    </div>
  )
}

const CHIP_TONES = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success-ink",
  info: "bg-info-soft text-info-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
  neutral: "bg-neutral-soft text-neutral-ink",
}

/**
 * 56px tinted icon chip above connect-step headings.
 *
 * @param {object} props
 * @param {"primary"|"success"|"info"|"warning"|"danger"|"neutral"} [props.tone="primary"]
 */
export function IconChip({ tone = "primary", className, children }) {
  return (
    <div className={cn("mb-6 flex size-14 items-center justify-center rounded-frame", CHIP_TONES[tone], className)}>
      {children}
    </div>
  )
}

function RadioMark({ selected, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        selected ? "bg-primary" : "border-2 border-border bg-background",
        className
      )}
    >
      {selected && <span className="size-2 rounded-full bg-background" />}
    </span>
  )
}

/**
 * Group of option cards on a muted well (Paper: Option cards). Children are
 * OptionCards. `mode="select"` is a true single-select radiogroup; `"action"`
 * is for cards that act on click (and advance the wizard), so it is a plain
 * group of buttons. `density="compact"` is a 2-then-3 column grid of slim cards
 * for long lists.
 */
export function OptionGrid({ children, className, label, mode = "select", density = "default" }) {
  return (
    <div
      role={mode === "select" ? "radiogroup" : "group"}
      aria-label={label}
      className={cn(
        "grid gap-1 rounded-frame bg-muted p-1",
        density === "compact" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * One option card: 36px icon tile and a radio on top, label and hint below.
 * The selected card lifts off the well in white.
 *
 * @param {object} props
 * @param {React.ReactNode} props.icon
 * @param {string} props.label
 * @param {string} [props.hint]
 * @param {boolean} props.selected
 * @param {() => void} props.onClick
 * @param {"select"|"action"} [props.mode="select"] "action" renders a plain button: no radio, no aria-checked
 * @param {"default"|"compact"} [props.density="default"] compact drops the icon tile: the icon sits inline before the label
 */
export function OptionCard({ icon, label, hint, selected, onClick, mode = "select", density = "default" }) {
  const isSelect = mode === "select"
  const surface = selected ? "bg-background shadow-floating" : "hover:bg-background/60"
  const base =
    "rounded-frame text-left outline-none transition-[background-color,box-shadow] duration-150 ease-press focus-visible:shadow-control-focus"

  if (density === "compact") {
    return (
      <button
        type="button"
        role={isSelect ? "radio" : undefined}
        aria-checked={isSelect ? selected : undefined}
        onClick={onClick}
        className={cn("flex items-center gap-2 px-3 py-2.5", base, surface)}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          <span className="num mr-1.5 text-muted-foreground">{icon}</span>
          {label}
          {hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{hint}</span>}
        </span>
        {isSelect && <RadioMark selected={selected} className="size-[22px]" />}
      </button>
    )
  }

  return (
    <button
      type="button"
      role={isSelect ? "radio" : undefined}
      aria-checked={isSelect ? selected : undefined}
      onClick={onClick}
      className={cn("flex flex-col gap-3.5 p-4", base, surface)}
    >
      <span className="flex items-start justify-between">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-control [&_svg]:size-[18px]",
            selected ? "bg-muted text-foreground" : "bg-background text-muted-foreground shadow-control"
          )}
        >
          {icon}
        </span>
        {isSelect && <RadioMark selected={selected} className="size-[22px]" />}
      </span>
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </button>
  )
}

/**
 * Single-select scrollable list (clients / ad accounts / channels).
 * items: [{ id, title, sub, leading }] — leading is a ReactNode (avatar/icon).
 */
export function PickList({ items, selectedId, onPick, maxHeight = 280, emptyText = "Nothing found" }) {
  return (
    <div
      role="radiogroup"
      className="mb-6 overflow-y-auto rounded-surface bg-background shadow-surface"
      style={{ maxHeight }}
    >
      {items.length === 0 && (
        <div className="px-4 py-5 text-center text-xs text-muted-foreground">{emptyText}</div>
      )}
      {items.map((item) => {
        const selected = selectedId === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(item)}
            className={cn(
              "flex w-full items-center gap-3 border-t border-border/60 px-4 py-3 text-left outline-none transition-colors first:border-t-0 focus-visible:bg-muted",
              selected ? "bg-primary-soft" : "hover:bg-muted"
            )}
          >
            <RadioMark selected={selected} className="size-[18px]" />
            {item.leading}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
              {item.sub && <span className="block truncate text-xs text-muted-foreground">{item.sub}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Initials avatar used by the client picker rows. */
export function InitialsAvatar({ name }) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-control bg-primary-soft text-xs font-semibold text-primary">
      {initials}
    </div>
  )
}

/** Solid-fill Facebook glyph (brand mark — not a Lucide icon). */
export function FacebookGlyph({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
    </svg>
  )
}

/** Solid-fill Slack glyph (brand mark). */
export function SlackGlyph({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M6 15a2 2 0 1 1 0-4h2v2a2 2 0 0 1-2 2zm0-6a2 2 0 1 1 0 4H4a2 2 0 1 1 0-4h2zm9 2a2 2 0 1 1 0 4h-2v-2a2 2 0 0 1 2-2zm0 6a2 2 0 1 1 0-4h2a2 2 0 1 1 0 4h-2zM9 6a2 2 0 1 1 4 0v2H9V6zm6 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0zM9 18a2 2 0 1 1-4 0v-2h4v2zm6 0a2 2 0 1 1-4 0v-2h4v2z" />
    </svg>
  )
}

/** Slack-style dark preview card used on the channel step. */
export function SlackPreviewCard({ time, children }) {
  return (
    <div className="min-h-20 rounded-surface bg-(--slack-surface) px-4 py-3.5" style={SLACK_PREVIEW_VARS}>
      <div className="flex gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-control bg-primary text-sm font-semibold text-primary-foreground">
          B
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-primary-foreground">Birdy</span>
            <span className="text-xs text-primary-foreground/60">{time}</span>
          </div>
          <div className="mt-1 text-xs leading-relaxed text-primary-foreground/90">{children}</div>
        </div>
      </div>
    </div>
  )
}
