"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircleIcon, CheckIcon, ClockIcon, InfoIcon, MinusIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { askBirdy } from "@/lib/ask-birdy"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Badge } from "../primitives/badge"
import { Button } from "../primitives/button"
import { Frame } from "../surfaces/frame"

const MAX_ROWS = 5

// Soft tinted chip behind each row's icon; the icon takes the tone's ink.
const TONES = {
  danger: { chip: "bg-danger-soft text-danger-ink", Icon: AlertCircleIcon },
  warning: { chip: "bg-warning-soft text-warning-ink", Icon: ClockIcon },
  success: { chip: "bg-success-soft text-success-ink", Icon: CheckIcon },
  info: { chip: "bg-info-soft text-info-ink", Icon: InfoIcon },
  neutral: { chip: "bg-neutral-soft text-neutral-ink", Icon: MinusIcon },
}

function Action({ action }) {
  // Fixed-width slot so the buttons line up down the list whatever the label.
  if (!action) return <span className="w-20 shrink-0" aria-hidden="true" />
  const { label, onClick, href } = action
  return (
    <span className="w-20 shrink-0">
      {href ? (
        <Button asChild size="sm" className="w-full">
          <Link href={href}>
            <span className="truncate">{label}</span>
          </Link>
        </Button>
      ) : (
        <Button size="sm" className="w-full" onClick={onClick}>
          <span className="truncate">{label}</span>
        </Button>
      )}
    </span>
  )
}

// Icon-only dismiss, in a fixed slot so rows line up whether or not they have one.
function Dismiss({ title, onDismiss }) {
  if (!onDismiss) return <span className="size-8 shrink-0" aria-hidden="true" />
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="shrink-0 text-muted-foreground"
      aria-label={`Dismiss ${typeof title === "string" ? title : "finding"}`}
      onClick={onDismiss}
    >
      <XIcon />
    </Button>
  )
}

/**
 * Birdy's short list of what needs attention: a muted `Frame` with the framed
 * mascot and a count in the header strip, actionable rows (at most 5) on the
 * frame surface and the "Ask Birdy" link in the footer strip.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.title="Birdy's read"]
 * @param {{id: string, tone: "danger"|"warning"|"success"|"info"|"neutral", title: React.ReactNode, detail?: React.ReactNode, tag?: string, action?: {label: string, onClick?: () => void, href?: string}, onDismiss?: () => void}[]} props.findings
 *   `onDismiss` adds an icon-only dismiss button after the action; `tag` is a small label beside the title (where the finding came from)
 * @param {number} [props.count] The header count when the rows are `children`; defaults to the number of findings
 * @param {React.ReactNode} [props.children] Custom rows in place of `findings` (e.g. a work list with its own decisions); not capped at five
 * @param {string} [props.prompt] Seeds the "Ask Birdy about this" footer link
 * @param {(prompt: string) => void} [props.onAsk] Handles that link instead of opening the global assistant (a client page sends it to its own chat)
 * @param {React.ReactNode} [props.empty] Shown with no findings; defaults to "Nothing needs you right now."
 */
function BirdyRead({ title = "Birdy's read", findings = [], count, prompt, onAsk, empty, className, children, ...props }) {
  const rows = findings.slice(0, MAX_ROWS)
  const canDismiss = rows.some((f) => f.onDismiss)
  const custom = children != null && children !== false
  const total = count ?? findings.length

  return (
    <Frame
      data-ds="birdy-read"
      className={className}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <BirdyAvatar size={28} tone="white" className="shrink-0" />
          <span className="truncate">{title}</span>
          {total > 0 && (
            <>
              <span
                data-slot="birdy-read-count"
                aria-hidden="true"
                className="num inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground"
              >
                {total}
              </span>
              <span className="sr-only">{` \u2014 ${total} ${total === 1 ? "item" : "items"}`}</span>
            </>
          )}
        </span>
      }
      footer={
        prompt ? (
          <button
            type="button"
            onClick={() => (onAsk ? onAsk(prompt) : askBirdy(prompt))}
            className="rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:shadow-control-focus"
          >
            Ask Birdy about this →
          </button>
        ) : undefined
      }
      {...props}
    >
      {custom ? (
        children
      ) : rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          {empty ?? "Nothing needs you right now."}
        </div>
      ) : (
        <ul className="divide-y divide-divider">
          {rows.map((f) => {
            const { chip, Icon } = TONES[f.tone] ?? TONES.neutral
            return (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", chip)}
                  aria-hidden="true"
                >
                  <Icon className="size-4" strokeWidth={2.5} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-2 text-base font-medium text-foreground" title={typeof f.title === "string" ? f.title : undefined}>{f.title}</span>
                  {f.tag && (
                    <Badge data-slot="birdy-read-tag" tone="primary" size="sm" className="mt-1">
                      {f.tag}
                    </Badge>
                  )}
                  {f.detail && (
                    <span className="line-clamp-2 text-xs text-muted-foreground" title={typeof f.detail === "string" ? f.detail : undefined}>
                      {f.detail}
                    </span>
                  )}
                </div>
                <Action action={f.action} />
                {canDismiss && <Dismiss title={f.title} onDismiss={f.onDismiss} />}
              </li>
            )
          })}
        </ul>
      )}
    </Frame>
  )
}

export { BirdyRead }
