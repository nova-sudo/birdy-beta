"use client"

import { Clock, Hash, Plus, Zap } from "lucide-react"
import { Badge, Surface, Switch } from "@/components/ds"
import { cn } from "@/lib/utils"
import { contentSummary, contentTitle, lastRunLabel, triggerLabel } from "./report-format"

const RUN_TONE = { success: "text-success-ink", danger: "text-danger-ink", neutral: "text-muted-foreground" }

/**
 * One Slack report on the hub: name and on/off, what starts it, a glimpse of
 * what it says, where it posts and how the last send went. The whole card
 * opens the report; the switch is a sibling of that button, never inside it.
 */
export function ReportCard({ report, alerts, defaultChannel, onOpen, onToggle }) {
  const isEvent = report.trigger?.type === "event"
  const TriggerIcon = isEvent ? Zap : Clock
  const run = lastRunLabel(report.last_run)
  const channel = report.channel_name || report.channel_id || defaultChannel
  const title = contentTitle(report.template)
  const summary = contentSummary(report.summary)

  return (
    <div className="group relative">
      <Surface
        as="button"
        type="button"
        onClick={() => onOpen(report)}
        className={cn(
          "flex h-full w-full cursor-pointer flex-col gap-3 text-left outline-none transition-shadow duration-200",
          "hover:shadow-floating focus-visible:shadow-control-focus motion-reduce:transition-none",
          !report.enabled && "opacity-70",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 pr-12">
          <span className="truncate text-base font-semibold text-foreground">{report.name}</span>
          {report.is_default && <Badge size="sm" tone="muted">Default</Badge>}
        </span>

        <Badge size="sm" tone={isEvent ? "warning" : "primary"} className="self-start">
          <TriggerIcon aria-hidden />
          {triggerLabel(report.trigger, alerts)}
        </Badge>

        <span className="flex min-h-14 flex-col gap-0.5 rounded-control bg-muted px-3 py-2 text-xs leading-snug text-muted-foreground">
          {title && <span className="truncate font-semibold text-foreground">{title}</span>}
          <span className="line-clamp-2">{summary || "No content yet"}</span>
        </span>

        <span className="mt-auto flex min-w-0 flex-col gap-0.5 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Hash aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{channel || "No channel chosen"}</span>
          </span>
          <span className={cn("truncate", run ? RUN_TONE[run.tone] : "text-muted-foreground")}>
            {report.enabled ? (run?.text ?? "Not sent yet") : "Off"}
          </span>
        </span>
      </Surface>

      <Switch
        checked={report.enabled}
        onCheckedChange={(on) => onToggle(report, on)}
        aria-label={`${report.enabled ? "Turn off" : "Turn on"} ${report.name}`}
        className="absolute right-4 top-4"
      />
    </div>
  )
}

/** The dashed card that closes the grid. */
export function NewReportCard({ onClick, disabled }) {
  return (
    <Surface
      as="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[208px] w-full cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border text-center shadow-none outline-none transition-colors hover:bg-muted/50 focus-visible:shadow-control-focus disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex size-10 items-center justify-center rounded-control bg-primary-soft text-primary">
        <Plus aria-hidden className="size-5" />
      </span>
      <span className="text-sm font-semibold text-foreground">New report</span>
      <span className="text-xs text-muted-foreground">On a schedule, or when something happens in Birdy</span>
    </Surface>
  )
}
