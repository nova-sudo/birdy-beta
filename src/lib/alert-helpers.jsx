"use client"

import { useState, useEffect } from "react"
import { Clock, Zap } from "lucide-react"
import { useCurrency } from "@/hooks/useCurrency"
import { Badge } from "@/components/ds/primitives/badge"
import { ProgressBar } from "@/components/ds/data/progress-bar"
import { ghlIcon, metaIcon, hpIcon } from "@/lib/icons"

export const METRIC_OPTIONS = [
  // ── Meta Ads metrics ──
  { value: "spend",            label: "Total Spend",           source: "meta", icon: metaIcon },
  { value: "impressions",      label: "Impressions",           source: "meta", icon: metaIcon },
  { value: "clicks",           label: "Clicks",                source: "meta", icon: metaIcon },
  { value: "reach",            label: "Reach",                 source: "meta", icon: metaIcon },
  { value: "ctr",              label: "CTR (%)",               source: "meta", icon: metaIcon },
  { value: "cpc",              label: "CPC ($)",               source: "meta", icon: metaIcon },
  { value: "cpm",              label: "CPM ($)",               source: "meta", icon: metaIcon },
  { value: "meta_leads",       label: "Leads",                 source: "meta", icon: metaIcon },
  { value: "meta_conversion",  label: "Conversion Rate (%)",   source: "meta", icon: metaIcon },
  { value: "cpl",              label: "Cost Per Lead ($)",      source: "meta", icon: metaIcon },
  { value: "cost_per_result",  label: "Cost Per Result ($)",    source: "meta", icon: metaIcon },
  { value: "frequency",        label: "Ad Frequency",          source: "meta", icon: metaIcon },
  // ── GHL metrics ──
  { value: "ghl_leads",        label: "Leads",                 source: "ghl",  icon: ghlIcon },
  { value: "ghl_conversion",   label: "Conversion Rate (%)",   source: "ghl",  icon: ghlIcon },
  { value: "ghl_revenue",      label: "Revenue",               source: "ghl",  icon: ghlIcon },
  // ── Call Center (HotProspector) — per-client ──
  { value: "hp_leads",            label: "Call Center Leads",  source: "hp",   icon: hpIcon },
  { value: "hp_total_calls",      label: "Total Calls",        source: "hp",   icon: hpIcon },
  { value: "hp_inbound",          label: "Inbound Calls",      source: "hp",   icon: hpIcon },
  { value: "hp_outbound",         label: "Outbound Calls",     source: "hp",   icon: hpIcon },
  { value: "hp_transfers",        label: "Call Transfers",     source: "hp",   icon: hpIcon },
  { value: "hp_leads_with_calls", label: "Leads Called",       source: "hp",   icon: hpIcon },
  { value: "hp_answered_calls",   label: "Answered Calls",     source: "hp",   icon: hpIcon },
  { value: "hp_talk_time",        label: "Talk Time (min)",    source: "hp",   icon: hpIcon },
  { value: "hp_connect_rate",     label: "Connect Rate (%)",   source: "hp",   icon: hpIcon },
  { value: "hp_answer_rate",      label: "Answer Rate (%)",    source: "hp",   icon: hpIcon },
  // ── Call Center (HotProspector) — per-agent, account-wide ──
  { value: "hp_agent_outbound",    label: "Agent Outbound Calls",  source: "hp",   icon: hpIcon },
  { value: "hp_agent_inbound",     label: "Agent Inbound Calls",   source: "hp",   icon: hpIcon },
  { value: "hp_agent_dialed",      label: "Agent Total Dials",     source: "hp",   icon: hpIcon },
  { value: "hp_agent_answered",    label: "Agent Answered Calls",  source: "hp",   icon: hpIcon },
  { value: "hp_agent_convos",      label: "Conversations",         source: "hp",   icon: hpIcon },
  { value: "hp_agent_appts",       label: "Appointments Set",      source: "hp",   icon: hpIcon },
  { value: "hp_agent_talk_min",    label: "Agent Talk Time (min)", source: "hp",   icon: hpIcon },
  { value: "hp_agent_sms",         label: "SMS Sent",              source: "hp",   icon: hpIcon },
  { value: "hp_agent_answer_rate", label: "Agent Answer Rate (%)", source: "hp",   icon: hpIcon },
]

export const TYPE_OPTIONS = [
  { value: "win", label: "Win" },
  { value: "warning", label: "Warning" },
]

export const OPERATOR_OPTIONS = [
  { value: "gt", label: "Greater than" },
  { value: "lt", label: "Less than" },
  { value: "eq", label: "Equal to" },
  { value: "neq", label: "Not equal to" },
  { value: "pct_rise", label: "Rises by (↑ %)" },
  { value: "pct_drop", label: "Drops by (↓ %)" },
]

export const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "day", label: "Yesterday" },
  { value: "week", label: "Last 7 Days" },
  { value: "month", label: "Last 30 Days" },
  { value: "custom", label: "Custom period" },
]

export const FREQUENCY_OPTIONS = [
  { value: "realtime", label: "Real-time" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
]

export const SNOOZE_OPTIONS = [
  { value: 1, label: "1 hour" },
  { value: 4, label: "4 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "24 hours" },
  { value: 48, label: "2 days" },
  { value: 168, label: "1 week" },
]

export function formatRelative(date) {
  if (!date) return "—"
  const diff = date - new Date()
  const absDiff = Math.abs(diff)
  const mins = Math.round(absDiff / 60000)
  const hours = Math.round(absDiff / 3600000)
  const days = Math.round(absDiff / 86400000)

  if (diff > 0) {
    if (days > 1) return `in ${days} days`
    if (hours > 1) return `in ${hours} hours`
    return `in ${mins} minutes`
  } else {
    if (days > 1) return `${days} days ago`
    if (hours > 1) return `${hours} hours ago`
    if (mins > 0) return `${mins} minutes ago`
    return "just now"
  }
}

export function conditionSummary(alert) {
  const { condition } = alert
  if (!condition) return "—"
  const op = condition.operator
  const val = condition.value

  if (op === "pct_drop") return `↓ ${val}%  vs ${condition.period || "week"}`
  if (op === "pct_rise") return `↑ ${val}%  vs ${condition.period || "week"}`
  if (op === "gt") return `> ${val}`
  if (op === "lt") return `< ${val}`
  if (op === "eq") return `= ${val}`
  if (op === "neq") return `≠ ${val}`
  return `${op} ${val}`
}

/**
 * Relative time ("2 hours ago"). Reads the clock in an effect, never during
 * render, so server and client markup agree.
 *
 * @param {object} props
 * @param {string|Date|null} props.value
 */
export function RelativeTime({ value }) {
  const [label, setLabel] = useState("—")
  useEffect(() => {
    setLabel(value ? formatRelative(new Date(value)) : "—")
  }, [value])
  return <span suppressHydrationWarning>{label}</span>
}

export function statusBadge(status, snoozedUntil) {
  if (status === "active") return <Badge variant="dot" tone="success">Active</Badge>
  if (status === "triggered") return <Badge variant="dot" tone="danger">Triggered</Badge>
  if (status === "paused") {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="dot" tone="warning">Snoozed</Badge>
        {snoozedUntil && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Until <RelativeTime value={snoozedUntil} />
          </span>
        )}
      </div>
    )
  }
  return <Badge variant="dot" className="capitalize">{status}</Badge>
}

/**
 * A metric's label with its hard-coded "($)" shown in the user's own currency.
 * The shared METRIC_OPTIONS labels stay as they are (the dashboard reads them).
 */
export function localiseMetricLabel(label, symbol) {
  return typeof label === "string" ? label.replace("($)", `(${symbol})`) : label
}

export function ProgressToTrigger({ alert }) {
  const { currencySymbol } = useCurrency("GBP")
  const pct = alert.progress_pct ?? 0
  const current = alert.current_value ?? null
  const threshold = alert.condition?.value
  const operator = alert.condition?.operator
  const triggered = alert.status === "triggered"

  if (current === null || current === undefined) {
    return <span className="text-xs text-muted-foreground">Not evaluated yet</span>
  }

  const isPctOperator = ["pct_drop", "pct_rise"].includes(operator)
  const isCurrency = !isPctOperator && ["spend", "cpc", "cpm", "cpl", "cost_per_result", "ghl_revenue"].includes(alert.condition?.metric)
  const isPct = isPctOperator || ["ctr", "meta_conversion", "ghl_conversion", "hp_connect_rate", "hp_answer_rate", "hp_agent_answer_rate"].includes(alert.condition?.metric)
  const fmt = (v, forceType) => {
    // For pct operators: current_value is always a % change, threshold is always a %
    if (forceType === "pct" || isPct) return `${Number(v).toFixed(1)}%`
    if (forceType === "currency" || isCurrency) return `${currencySymbol}${Number(v).toFixed(2)}`
    return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })
  }
  // For pct operators the threshold is a percentage, but display it as %
  const fmtThreshold = (v) => {
    if (isPctOperator) return `${Number(v).toFixed(1)}%`
    return fmt(v)
  }

  const opLabel = operator === "gt" ? ">" : operator === "lt" ? "<" : operator === "eq" ? "=" : operator === "neq" ? "≠" : operator === "pct_drop" ? "↓" : "↑"

  return (
    <div className="flex min-w-[140px] max-w-[180px] flex-col gap-1">
      <span className="num text-sm font-semibold">{fmt(current)}</span>
      <ProgressBar value={pct} triggered={triggered} label="Progress to trigger" />
      <div className="num text-xs text-muted-foreground">
        {triggered ? <span className="font-semibold text-danger-ink">Triggered</span> : `${Math.max(0, pct).toFixed(0)}% to trigger`}
        {" "}{opLabel} {fmtThreshold(threshold)}
      </div>
    </div>
  )
}

export function metricIcon(metricValue) {
  const found = METRIC_OPTIONS.find(m => m.value === metricValue)
  if (!found) return <Zap className="h-4 w-4" />
  return <Zap className="h-4 w-4" />
}

export const EMPTY_FORM = {
  name: "",
  description: "",
  type: "warning",
  metric: "spend",
  operator: "gt",
  value: "0",
  period: "day",
  target_group_ids: [],
  notification_channels: ["in_app"],
  frequency: "daily",
  tracking_mode: "total",
}
