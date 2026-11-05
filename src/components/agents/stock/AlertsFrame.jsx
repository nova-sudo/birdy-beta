"use client"

import Link from "next/link"

import { Badge, Frame } from "@/components/ds"

const SEVERITY = {
  critical: { tone: "danger", label: "Needs you" },
  warning: { tone: "warning", label: "Worth a look" },
  info: { tone: "neutral", label: "For info" },
}
const ORDER = ["critical", "warning", "info"]
const NO_CARD_STATES = ["no_zones", "no_data", "data_late"]

const META_ERROR = /meta graph error/i
const NO_ACCESS = /\(#(10|200)\)|permission|not grant/i

/** Meta's own error text says nothing to a media buyer, and older reports have it stored, so it is translated when shown. */
export function plainError(text) {
  if (!text || !META_ERROR.test(text)) return text
  return NO_ACCESS.test(text)
    ? "Meta hasn't given Birdy access to this ad account. Check the account's permissions in Meta."
    : "Meta returned an error while Birdy was reading this account. Birdy checks it again on the next report."
}

/** What the run couldn't do for a client. These matter as much as alerts: they are clients the rest of the report says nothing about. */
export function clientProblems(run, nameOf) {
  const clients = Object.entries(run.clients ?? {})
  const summary = run.summary ?? {}
  return [
    ...clients
      .filter(([, c]) => c.state === "failed")
      .map(([gid, c]) => ({ key: `failed-${gid}`, gid, tone: "warning", label: "Not checked", title: `${nameOf(gid)} couldn't be checked`, detail: plainError(c.error) || "Birdy didn't record why." })),
    ...clients
      .filter(([, c]) => NO_CARD_STATES.includes(c.state))
      .map(([gid, c]) => ({ key: `nocard-${gid}`, gid, tone: "neutral", label: "No card", title: `${nameOf(gid)} has no card today`, detail: c.reason })),
    ...(summary.missing ?? []).map((gid) => ({ key: `missing-${gid}`, gid, tone: "warning", label: "Not finished", title: `${nameOf(gid)} wasn't finished` })),
    ...(summary.health_unread ?? []).map((gid) => ({ key: `health-${gid}`, gid, tone: "warning", label: "Not checked", title: `${nameOf(gid)}'s account health couldn't be read` })),
  ]
}

/** An alert's badge. */
export function alertBadge(alert) {
  if (alert.code === "spend_stopped") return { tone: "danger", label: "Spend stopped" }
  return SEVERITY[alert.severity] ?? SEVERITY.info
}

/** Alerts about the whole agency, such as Meta needing reconnecting. A client's own alerts are in its panel. */
export function AlertsFrame({ alerts }) {
  const sorted = [...alerts].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))
  return (
    <Frame title="Alerts" action={<Badge tone={alerts.some((a) => a.severity === "critical") ? "danger" : "warning"} size="sm">{alerts.length}</Badge>}>
      {sorted.map((alert, i) => {
        const { tone, label } = alertBadge(alert)
        return (
          <div key={`${alert.code}-${i}`} className="flex flex-wrap items-start justify-between gap-2.5 border-b px-4 py-3 last:border-b-0">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{alert.title}</div>
              {alert.detail && <div className="text-xs text-muted-foreground">{plainError(alert.detail)}</div>}
            </div>
            <span className="flex items-center gap-2">
              {alert.code === "meta_reconnect" && <Link href="/settings?tab=integrations" className="text-sm font-medium underline">Reconnect</Link>}
              <Badge tone={tone} size="sm">{label}</Badge>
            </span>
          </div>
        )
      })}
    </Frame>
  )
}
