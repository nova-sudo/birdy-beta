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

/** What the run couldn't do for a client, as rows. These matter as much as alerts: they are clients the rest of the report says nothing about. */
export function clientProblems(run, nameOf) {
  const clients = Object.entries(run.clients ?? {})
  const summary = run.summary ?? {}
  return [
    ...clients
      .filter(([, c]) => c.state === "failed")
      .map(([gid, c]) => ({ key: `failed-${gid}`, tone: "warning", label: "Not checked", title: `${nameOf(gid)} couldn't be checked`, detail: c.error || "Birdy didn't record why." })),
    ...clients
      .filter(([, c]) => NO_CARD_STATES.includes(c.state))
      .map(([gid, c]) => ({ key: `nocard-${gid}`, tone: "neutral", label: "No card", title: `${nameOf(gid)} has no card today`, detail: c.reason })),
    ...(summary.missing ?? []).map((gid) => ({ key: `missing-${gid}`, tone: "warning", label: "Not finished", title: `${nameOf(gid)} wasn't finished` })),
    ...(summary.health_unread ?? []).map((gid) => ({ key: `health-${gid}`, tone: "warning", label: "Not checked", title: `${nameOf(gid)}'s account health couldn't be read` })),
  ]
}

function Row({ title, detail, tone, label, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2.5 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </div>
      <span className="flex items-center gap-2">
        {action}
        <Badge tone={tone} size="sm">{label}</Badge>
      </span>
    </div>
  )
}

/** Alerts, most urgent first, then the clients the run couldn't finish. */
export function AlertsFrame({ alerts, problems, nameOf, inProgress = false }) {
  const count = alerts.length + problems.length
  const sorted = [...alerts].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))

  const titled = (alert) => {
    if (!alert.client_group_id) return alert.title
    const name = nameOf(alert.client_group_id)
    return alert.title?.includes(name) ? alert.title : `${name}: ${alert.title}`
  }
  const badge = (alert) => {
    if (alert.code === "spend_stopped") return { tone: "danger", label: "Spend stopped" }
    return SEVERITY[alert.severity] ?? SEVERITY.info
  }

  return (
    <Frame title="Alerts" action={count > 0 ? <Badge tone={alerts.some((a) => a.severity === "critical") ? "danger" : "warning"} size="sm">{count}</Badge> : undefined}>
      {count === 0 && (
        <p className="px-4 py-3 text-xs text-muted-foreground">{inProgress ? "No alerts so far." : "Clean: no alerts on any client."}</p>
      )}
      {sorted.map((alert, i) => (
        <Row
          key={`${alert.client_group_id}-${alert.code}-${i}`}
          title={titled(alert)}
          detail={alert.detail}
          {...badge(alert)}
          action={alert.code === "meta_reconnect" ? <Link href="/settings?tab=integrations" className="text-sm font-medium underline">Reconnect</Link> : undefined}
        />
      ))}
      {problems.map(({ key, ...row }) => (
        <Row key={key} {...row} />
      ))}
    </Frame>
  )
}
