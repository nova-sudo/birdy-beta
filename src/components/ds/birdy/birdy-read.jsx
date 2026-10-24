"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircleIcon, CheckIcon, ClockIcon, InfoIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { askBirdy } from "@/lib/ask-birdy"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Button } from "../primitives/button"
import { Frame } from "../surfaces/frame"
import { Surface } from "../surfaces/surface"

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

/**
 * Birdy's short list of what needs attention: a muted `Frame` with the framed
 * mascot, a count and a white `Surface` of actionable rows (at most 5).
 *
 * @param {object} props
 * @param {React.ReactNode} [props.title="Birdy's read"]
 * @param {{id: string, tone: "danger"|"warning"|"success"|"info"|"neutral", title: React.ReactNode, detail?: React.ReactNode, action?: {label: string, onClick?: () => void, href?: string}}[]} props.findings
 * @param {string} [props.prompt] Seeds the "Ask Birdy about this" footer link
 * @param {React.ReactNode} [props.empty] Shown with no findings; defaults to "Nothing needs you right now."
 */
function BirdyRead({ title = "Birdy's read", findings = [], prompt, empty, className, ...props }) {
  const rows = findings.slice(0, MAX_ROWS)

  return (
    <Frame
      data-ds="birdy-read"
      className={className}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <BirdyAvatar size={28} tone="white" className="shrink-0" />
          <span className="truncate">{title}</span>
          {findings.length > 0 && (
            <>
              <span
                data-slot="birdy-read-count"
                aria-hidden="true"
                className="num inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground"
              >
                {findings.length}
              </span>
              <span className="sr-only">{` \u2014 ${findings.length} ${findings.length === 1 ? "item" : "items"}`}</span>
            </>
          )}
        </span>
      }
      {...props}
    >
      <Surface padded={false}>
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            {empty ?? "Nothing needs you right now."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
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
                    <span className="truncate text-[15px] font-medium text-foreground">{f.title}</span>
                    {f.detail && <span className="truncate text-xs text-muted-foreground">{f.detail}</span>}
                  </div>
                  <Action action={f.action} />
                </li>
              )
            })}
          </ul>
        )}
      </Surface>
      {prompt && (
        <button
          type="button"
          onClick={() => askBirdy(prompt)}
          className="self-start px-1 text-sm font-medium text-primary outline-none hover:underline focus-visible:shadow-control-focus"
        >
          Ask Birdy about this →
        </button>
      )}
    </Frame>
  )
}

export { BirdyRead }
