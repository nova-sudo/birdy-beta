"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Badge, Surface } from "@/components/ds"
import { cn } from "@/lib/utils"

const STATUS_DOT = { ok: "bg-success", setting: "bg-warning", off: "bg-subdued", danger: "bg-danger" }

/** A status word with its dot: "Live", "Setting up", "Turned off", "Sent today". */
export function HubStatus({ tone = "ok", className, children }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums", className)}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[tone] ?? STATUS_DOT.off)} />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}

/**
 * One compact card on BirdyHub: icon, title, an optional tag, one line, an
 * optional status line and a quiet "Open ›" cue. The whole card is a link
 * (`href`) or a button (`onClick`).
 *
 * `actions` (a switch, a delete button) are laid over the top-right corner as
 * siblings of the link, never inside it; the cue then drops to the bottom row.
 *
 * @param {object} props
 * @param {string} [props.href]
 * @param {() => void} [props.onClick]
 * @param {React.ElementType} [props.icon] lucide icon
 * @param {React.ReactNode} props.title
 * @param {string} [props.tag] e.g. "Default"
 * @param {React.ReactNode} [props.line] one line of description
 * @param {React.ReactNode} [props.status] status words after the dot
 * @param {"ok"|"setting"|"off"} [props.statusTone="ok"]
 * @param {React.ReactNode} [props.extra] a footer row (schedule, channel, an error)
 * @param {React.ReactNode} [props.actions] controls over the top-right corner
 * @param {string} [props.actionsInset="pr-28"] room the title row leaves for `actions`
 * @param {string} [props.cue="Open"]
 * @param {boolean} [props.busy]
 * @param {boolean} [props.dimmed] a switched-off item
 */
export function HubCard({
  href,
  onClick,
  icon: Icon,
  title,
  tag,
  line,
  status,
  statusTone = "ok",
  extra,
  actions,
  actionsInset = "pr-28",
  cue = "Open",
  busy = false,
  dimmed = false,
  className,
}) {
  const body = (
    <>
      {Icon && (
        <span className="flex size-9 shrink-0 items-center justify-center self-center rounded-control bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-4" />
        </span>
      )}
      <span className={cn("flex min-w-0 flex-1 flex-col gap-0.5", dimmed && "opacity-70")}>
        <span className={cn("flex min-w-0 items-center gap-2", actions && actionsInset)}>
          <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{title}</span>
          {tag && (
            <Badge size="sm" tone="muted">
              {tag}
            </Badge>
          )}
        </span>
        {line && <span className="line-clamp-1 text-xs leading-snug text-muted-foreground">{line}</span>}
        {status && (
          <HubStatus tone={statusTone} className="mt-0.5">
            {status}
          </HubStatus>
        )}
        {extra && <span className="mt-0.5 flex min-w-0 items-center gap-3 text-xs text-muted-foreground">{extra}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary motion-reduce:transition-none",
          actions ? "self-end" : "self-center",
        )}
      >
        {cue}
        <ChevronRight className="size-3" />
      </span>
    </>
  )

  const cardClass = cn(
    "group flex h-full w-full items-start gap-3 px-4 py-3.5 text-left outline-none transition-shadow duration-200",
    "hover:shadow-floating focus-visible:shadow-control-focus motion-reduce:transition-none",
    "disabled:cursor-wait",
    className,
  )

  const card = href ? (
    <Surface as={Link} href={href} padded={false} className={cardClass}>
      {body}
    </Surface>
  ) : (
    <Surface
      as="button"
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy || undefined}
      padded={false}
      className={cn(cardClass, "cursor-pointer")}
    >
      {body}
    </Surface>
  )

  if (!actions) return card
  return (
    <div className="relative">
      {card}
      <div className="absolute right-4 top-3 flex items-center gap-2">{actions}</div>
    </div>
  )
}

/** The one card an empty section shows: an icon, a sentence and its "New …" button. */
export function HubEmptyCard({ icon: Icon, title, text, action }) {
  return (
    <Surface padded={false} className="flex items-center gap-3 px-4 py-3">
      {Icon && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-4" />
        </span>
      )}
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{title}</span> {text}
      </p>
      {action}
    </Surface>
  )
}

/** A hub section's header row: the heading (and an optional hint) on the left, its "New …" button on the right. */
export function HubSectionHeader({ id, title, hint, action }) {
  return (
    <div data-hub-section-header className="flex min-h-9 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h2 id={id} className="font-display text-lg font-semibold text-foreground">
          {title}
        </h2>
        {hint}
      </div>
      <div className="flex shrink-0 items-center">{action}</div>
    </div>
  )
}
