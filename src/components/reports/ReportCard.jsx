"use client"

import { Clock, Hash, TriangleAlert, Zap } from "lucide-react"
import { Switch } from "@/components/ds"
import { HubCard, HubStatus } from "@/components/hub/HubCard"
import { contentSummary, contentTitle, lastRunShort, triggerLabel } from "./report-format"

const STATUS_TONE = { success: "ok", danger: "danger", neutral: "setting" }

/**
 * One Slack report as a compact hub card: name, a Default tag, how the last
 * send went with its on/off switch, a line about what it says, and when and
 * where it posts. The whole card opens the report; the switch is a sibling of
 * that button (HubCard's `actions`), never inside it.
 */
export function ReportCard({ report, alerts, defaultChannel, onOpen, onToggle }) {
  const isEvent = report.trigger?.type === "event"
  const TriggerIcon = isEvent ? Zap : Clock
  const run = lastRunShort(report.last_run)
  const channel = report.channel_name || report.channel_id || defaultChannel
  const line = contentTitle(report.template) || contentSummary(report.summary) || "No content yet"
  const failed = report.enabled ? run?.error : null

  const status = !report.enabled
    ? <HubStatus tone="off">Off</HubStatus>
    : <HubStatus tone={run ? STATUS_TONE[run.tone] : "off"}>{run ? run.text : "Not sent yet"}</HubStatus>

  return (
    <HubCard
      onClick={() => onOpen(report)}
      title={report.name}
      tag={report.is_default ? "Default" : undefined}
      line={line}
      dimmed={!report.enabled}
      actionsInset="pr-40"
      actions={
        <>
          {status}
          <Switch
            checked={report.enabled}
            onCheckedChange={(on) => onToggle(report, on)}
            aria-label={`${report.enabled ? "Turn off" : "Turn on"} ${report.name}`}
          />
        </>
      }
      extra={
        <>
          <span className="inline-flex shrink-0 items-center gap-1">
            <TriggerIcon aria-hidden className="size-3.5" />
            {triggerLabel(report.trigger, alerts)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <Hash aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{channel || "No channel chosen"}</span>
          </span>
          {failed && (
            <span className="inline-flex min-w-0 items-center gap-1 text-danger-ink" title={failed}>
              <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{failed}</span>
            </span>
          )}
        </>
      }
    />
  )
}
