"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"

import { Button, Notice } from "@/components/ds"

/** The six guided steps, in order. */
export const STOCK_STEPS = ["Schedule", "Clients and targets", "Creative rules", "Slack", "Flag, Ask me or Auto", "Preview first report"]

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/**
 * The agent's settings as the setup forms read them. The server creates the stock agent with its default
 * settings, so every number and default comes from there; this only makes sure each part exists.
 */
export function settingsOf(agent) {
  const s = agent?.settings ?? {}
  return {
    ...s,
    batches: s.batches ?? [],
    weekly: { ...s.weekly },
    zones: { ...s.zones },
    treatments: s.treatments ?? [],
    clients: s.clients ?? {},
    creative: { ...s.creative },
    modes: { ...s.modes },
    slack: { ...s.slack },
  }
}

/** Parses a number field: "" is null, anything else must be a number, 0 or more. */
export function parseNumber(raw) {
  const text = String(raw ?? "").trim()
  if (text === "") return { ok: true, value: null }
  const n = Number(text)
  return Number.isFinite(n) && n >= 0 ? { ok: true, value: n } : { ok: false }
}

export const show = (n) => (n == null ? "" : String(n))

/** A 400's `errors` that name no client, as plain lines. */
export function generalErrors(err) {
  return (err?.errors ?? []).filter((e) => !e.client_group_id).map((e) => e.message)
}

/** A 400's `errors` for clients, as `{gid: message}`. */
export function clientErrors(err) {
  const out = {}
  for (const e of err?.errors ?? []) if (e.client_group_id) out[e.client_group_id] = e.message
  return out
}

/** The words for a save that was refused. */
export function saveMessage(err) {
  const lines = generalErrors(err)
  if (lines.length) return lines.join(" ")
  if (err?.status === 400 && err.errors?.length) return "Some settings need fixing. Check the highlighted rows."
  return `Couldn't save: ${err?.message || "try again in a moment"}`
}

/** Back and Continue under every step. */
export function SetupFooter({ onBack, onNext, saving = false, disabled = false, label = "Continue", children }) {
  return (
    <div className="flex items-center justify-between gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
      {onBack ? (
        <Button variant="ghost" onClick={onBack} disabled={saving}>
          <ArrowLeft aria-hidden />
          Back
        </Button>
      ) : (
        <span />
      )}
      {children ?? (
        <Button variant="primary" size="lg" loading={saving} disabled={disabled} onClick={onNext}>
          {label}
          <ArrowRight aria-hidden />
        </Button>
      )}
    </div>
  )
}

export function ErrorNotice({ children }) {
  return children ? <Notice tone="danger">{children}</Notice> : null
}
