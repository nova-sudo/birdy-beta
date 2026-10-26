"use client"

import { ClockIcon, DownloadIcon, MailIcon, PhoneIcon, PlayIcon, UserIcon } from "lucide-react"

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
} from "@/components/ds"
import { DirectionBadge, StatTile } from "./CallCentreParts"
import { formatDuration } from "./analysis"

function Detail({ label, children, className }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{children}</dd>
    </div>
  )
}

/**
 * Recording Play / Download links, as ds buttons. Kept as plain links: there is
 * no inline player.
 *
 * @param {object} props
 * @param {string} props.url
 * @param {boolean} [props.labelled] Show the words beside the icons
 */
export function RecordingLinks({ url, labelled = false }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button asChild size={labelled ? "sm" : "icon-sm"}>
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Play recording" title="Play recording">
          <PlayIcon />
          {labelled && "Play"}
        </a>
      </Button>
      <Button asChild size={labelled ? "sm" : "icon-sm"}>
        <a href={url} download aria-label="Download recording" title="Download recording">
          <DownloadIcon />
          {labelled && "Download"}
        </a>
      </Button>
    </div>
  )
}

/**
 * The Leads tab's "Call Logs" cell: a button with the call count that opens
 * the lead's calls in a ds Dialog, a stat strip over one row per call.
 *
 * @param {object} props
 * @param {object} props.lead A mapped lead (see mapLead) with `call_logs`
 */
export function CallLogsDialog({ lead }) {
  const logs = lead.call_logs
  const outboundCount = logs.filter((l) => l.call_status === "outbound").length
  const inboundCount = logs.length - outboundCount
  const talkSeconds = logs.reduce((sum, l) => sum + (l.duration || 0), 0)
  const callsLabel = `${lead.call_logs_count} ${lead.call_logs_count === 1 ? "call" : "calls"}`

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <PhoneIcon />
          {callsLabel}
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="truncate">{lead.name}</DialogTitle>
            <Badge tone="primary" className="shrink-0">
              {callsLabel}
            </Badge>
          </div>
          <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <MailIcon className="size-3.5" aria-hidden="true" />
              {lead.email}
            </span>
            <span className="flex items-center gap-1.5">
              <PhoneIcon className="size-3.5" aria-hidden="true" />
              {lead.phone}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div>
          {logs.length === 0 ? (
            <EmptyState
              icon={PhoneIcon}
              title="No Call Logs"
              description="No recorded calls for this lead in the selected period."
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <StatTile value={logs.length} label="Total calls" />
                <StatTile value={inboundCount} label="Inbound" />
                <StatTile value={outboundCount} label="Outbound" />
                <StatTile value={formatDuration(talkSeconds)} label="Talk time" />
              </div>

              <ul className="flex flex-col gap-3">
                {logs.map((callLog, index) => (
                  <li key={index} className="rounded-surface bg-muted px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground shadow-surface">
                        <UserIcon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{callLog.caller_name}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ClockIcon className="size-3" aria-hidden="true" />
                          {callLog.call_time}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <DirectionBadge direction={callLog.call_status} />
                        {callLog.transfer && <Badge tone="warning">Transferred</Badge>}
                      </div>
                      {callLog.recording_url && <RecordingLinks url={callLog.recording_url} labelled />}
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 border-t border-border pt-3 sm:grid-cols-4">
                      <Detail label="Duration">
                        <span className="num">{formatDuration(callLog.duration)}</span>
                      </Detail>
                      <Detail label="Speed to Lead">
                        <span className="num">{formatDuration(callLog.speed_to_lead)}</span>
                      </Detail>
                      <Detail label="Group">{callLog.group || "—"}</Detail>
                      <Detail label="From → To">
                        <span className="num font-mono">
                          {callLog.from_number || "—"} → {callLog.to_number || "—"}
                        </span>
                      </Detail>
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
