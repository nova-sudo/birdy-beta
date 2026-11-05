"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { MoreHorizontal, Send, Sparkles, Trash2 } from "lucide-react"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Notice,
  SegmentedTabs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  toast,
} from "@/components/ds"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { fetcher } from "@/lib/fetcher"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import { ReportContentDialog } from "./ReportContentDialog"
import {
  DATA_WINDOWS,
  EVENTS,
  WEEKDAYS,
  contentSummary,
  contentTitle,
  errorLabel,
  timeLabel,
  timezoneOptions,
  triggerLabel,
} from "./report-format"

const ACCOUNT_TZ = "__account__"
const ANY_ALERT = "__any__"
const BIRDY_CHANNEL = "__birdy__"

/** The form's state for a report, or for a new one. */
export function initialForm(report) {
  const t = report?.trigger
  return {
    name: report?.name ?? "",
    kind: t?.type ?? "schedule",
    frequency: t?.type === "schedule" ? t.frequency : "daily",
    day: (t?.type === "schedule" && t.day) || "Monday",
    time: (t?.type === "schedule" && t.time) || "09:00",
    timezone: (t?.type === "schedule" && t.timezone) || ACCOUNT_TZ,
    event: (t?.type === "event" && t.event) || "alert_fired",
    alertId: (t?.type === "event" && t.alert_id) || ANY_ALERT,
    channelId: report?.channel_id || BIRDY_CHANNEL,
    window: report?.template?.frequency ?? "daily",
    template: report?.template ?? null,
  }
}

/** The request body for a form, or { error } saying what to fix first. */
export function bodyFor(form, { isDefault = false, channels = [] } = {}) {
  if (!form.name.trim()) return { error: "Give the report a name" }
  if (form.kind === "schedule" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) return { error: "Choose a time" }
  const trigger = form.kind === "schedule"
    ? {
      type: "schedule", frequency: form.frequency, day: form.frequency === "weekly" ? form.day : null,
      time: form.time, timezone: form.timezone === ACCOUNT_TZ ? null : form.timezone,
    }
    : { type: "event", event: form.event, alert_id: form.event === "alert_fired" && form.alertId !== ANY_ALERT ? form.alertId : null }
  // The brief's numbers always cover its own period: daily → yesterday, weekly → last 7 days.
  const window = isDefault ? form.frequency : form.window
  const body = { name: form.name.trim(), trigger }
  const channel = channels.find((c) => c.id === form.channelId)
  body.channel_id = form.channelId === BIRDY_CHANNEL ? "" : form.channelId
  body.channel_name = channel?.name ?? null
  // Without content of its own the server keeps the report's (or the standard brief's) blocks.
  body.template = form.template ? { frequency: window, blocks: form.template.blocks } : { frequency: window }
  return { body }
}

function Field({ label, htmlFor, hint, children }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * Create or edit one Slack report, in a sheet over the hub: name, what starts
 * it, which window its numbers cover, the channel, and its content (designed
 * with the report copilot in a dialog). `report` null = a new report.
 */
export function ReportPanel({ open, onOpenChange, report, alerts, slack, api, accountTimezone }) {
  const isNew = !report
  const isDefault = Boolean(report?.is_default)
  const [form, setForm] = useState(() => initialForm(report))
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [designing, setDesigning] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setForm(initialForm(report))
      setError(null)
    }
  }, [open, report])

  const { data: channelData, error: channelError } = useSWR(open && slack?.installed ? queryKeys.slackChannels() : null, fetcher)
  const channels = channelData?.channels ?? []
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const zones = useMemo(
    () => timezoneOptions(form.timezone !== ACCOUNT_TZ ? form.timezone : null),
    [form.timezone],
  )
  const birdyChannel = slack?.notify_channel_name ? `#${slack.notify_channel_name}` : "Birdy's channel"
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm(report))

  const scheduleText = form.kind === "schedule"
    ? `${triggerLabel({ type: "schedule", frequency: form.frequency, day: form.day, time: form.time })}`
    : triggerLabel({ type: "event", event: form.event, alert_id: form.alertId === ANY_ALERT ? null : form.alertId }, alerts)

  async function save() {
    const { body, error: problem } = bodyFor(form, { isDefault, channels })
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (isNew) await api.create(body)
      else await api.update(report.id, body)
      toast.success(isNew ? `“${body.name}” created` : "Report saved")
      onOpenChange(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    setTesting(true)
    try {
      const { status, error: why } = await api.test(report.id)
      if (status === "sent") toast.success("Test sent to Slack")
      else toast.error(`Not sent: ${errorLabel(why)}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setTesting(false)
    }
  }

  async function remove() {
    try {
      await api.remove(report.id)
      toast.success("Report deleted")
      onOpenChange(false)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const title = contentTitle(form.template)
  const summary = form.template ? contentSummary(describeBlocks(form.template.blocks)) : null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" size="md" aria-describedby="report-panel-description">
          <SheetHeader
            actions={!isNew && !isDefault && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="More actions">
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
                    <Trash2 aria-hidden />
                    Delete report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          >
            <SheetTitle>{isNew ? "New report" : report.name}</SheetTitle>
            <SheetDescription id="report-panel-description">
              {isDefault ? "Your daily/weekly brief. Also set in onboarding and Settings." : "Posted to Slack, built from your live numbers."}
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="flex flex-col gap-5">
            <Field label="Name" htmlFor="report-name">
              <Input id="report-name" value={form.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Weekly leadership" />
            </Field>

            <Field label="When it sends">
              <SegmentedTabs
                ariaLabel="When it sends"
                fill
                value={form.kind}
                onValueChange={(kind) => set({ kind })}
                items={[
                  { value: "schedule", label: "Schedule" },
                  {
                    value: "event", label: "Birdy event", disabled: isDefault,
                    tooltip: isDefault ? "The brief always runs on a schedule" : undefined,
                  },
                ]}
              />
            </Field>

            {form.kind === "schedule" ? (
              <>
                <Field label="Repeats">
                  <SegmentedTabs
                    ariaLabel="Repeats"
                    value={form.frequency}
                    onValueChange={(frequency) => set({ frequency })}
                    items={[{ value: "daily", label: "Every day" }, { value: "weekly", label: "Weekly" }]}
                  />
                </Field>
                {form.frequency === "weekly" && (
                  <Field label="Day">
                    <div role="radiogroup" aria-label="Day" className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          role="radio"
                          aria-checked={form.day === d}
                          onClick={() => set({ day: d })}
                          className={cn(
                            "h-8 cursor-pointer rounded-full border px-3 text-sm outline-none transition-colors focus-visible:shadow-control-focus",
                            form.day === d
                              ? "border-transparent bg-primary-soft font-medium text-primary"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {d.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
                  <Field label="Time" htmlFor="report-time">
                    <Input id="report-time" type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} />
                  </Field>
                  <Field label="Timezone">
                    <Select value={form.timezone} onValueChange={(timezone) => set({ timezone })}>
                      <SelectTrigger aria-label="Timezone"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ACCOUNT_TZ}>Account ({accountTimezone || "Europe/London"})</SelectItem>
                        {zones.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <p className="-mt-3 text-xs text-muted-foreground">Arrives within 5 minutes of {timeLabel(form.time) || "the time you pick"}.</p>
              </>
            ) : (
              <Field label="Send when">
                <div role="radiogroup" aria-label="Send when" className="flex flex-col gap-2">
                  {EVENTS.map((ev) => {
                    const on = form.event === ev.value
                    return (
                      <div
                        key={ev.value}
                        className={cn(
                          "rounded-control border p-3 transition-shadow",
                          on ? "border-primary shadow-[0_0_0_3px_var(--color-primary-soft)]" : "border-border",
                        )}
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => set({ event: ev.value })}
                          className="flex w-full cursor-pointer items-start gap-2.5 text-left outline-none focus-visible:underline"
                        >
                          <span aria-hidden className={cn("mt-0.5 size-4 shrink-0 rounded-full border-2", on ? "border-[5px] border-primary" : "border-border")} />
                          <span className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground">{ev.label}</span>
                            <span className="text-xs text-muted-foreground">{ev.hint}</span>
                          </span>
                        </button>
                        {on && ev.value === "alert_fired" && (
                          <div className="mt-2.5 pl-6.5">
                            <Select value={form.alertId} onValueChange={(alertId) => set({ alertId })}>
                              <SelectTrigger aria-label="Which alert" size="sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={ANY_ALERT}>Any alert</SelectItem>
                                {alerts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Field>
            )}

            {!isDefault && (
              <Field label="Numbers cover" hint={form.kind === "event" ? "The window the report's figures use when the event happens." : undefined}>
                <SegmentedTabs ariaLabel="Numbers cover" value={form.window} onValueChange={(window) => set({ window })} items={DATA_WINDOWS} />
              </Field>
            )}

            <Field label="Channel" hint={channelError ? "Couldn't list your Slack channels — reconnect Slack in Settings." : "Private channels need Birdy invited first (/invite @Birdy)."}>
              <Select value={form.channelId} onValueChange={(channelId) => set({ channelId })}>
                <SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={BIRDY_CHANNEL}>{birdyChannel} (Birdy&apos;s channel)</SelectItem>
                  {form.channelId !== BIRDY_CHANNEL && !channels.some((c) => c.id === form.channelId) && (
                    <SelectItem value={form.channelId}>#{report?.channel_name || form.channelId}</SelectItem>
                  )}
                  {channels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}{c.is_private ? " (private)" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Content">
              <div className="flex flex-col gap-0.5 rounded-control bg-muted px-3 py-2.5 text-xs leading-snug text-muted-foreground">
                <span className="font-semibold text-foreground">{title || (form.template ? "Your report" : "Birdy's standard brief")}</span>
                <span>{summary || "Spend, leads and cost per lead, a client chart and alerts — until you design your own."}</span>
              </div>
              <Button variant="outline" onClick={() => setDesigning(true)} className="w-full">
                <Sparkles aria-hidden />
                Design content with Birdy
              </Button>
            </Field>

            {error && <Notice tone="danger">{error}</Notice>}
          </SheetBody>

          <SheetFooter className="justify-between">
            {!isNew ? (
              <Button variant="ghost" onClick={sendTest} loading={testing} disabled={dirty} title={dirty ? "Save first to test these changes" : undefined}>
                <Send aria-hidden />
                Send test
              </Button>
            ) : <span />}
            <Button variant="primary" onClick={save} loading={saving}>
              {isNew ? "Create report" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {!isNew && (
        <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this report?</AlertDialogTitle>
              <AlertDialogDescription>
                {`“${report.name}” will stop sending and be removed. This can't be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={remove}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <ReportContentDialog
        open={designing}
        onOpenChange={setDesigning}
        reportId={report?.id}
        template={form.template ? { frequency: isDefault ? form.frequency : form.window, blocks: form.template.blocks } : null}
        scheduleText={scheduleText}
        onUse={(t) => set({
          template: { frequency: t.frequency, blocks: t.blocks },
          ...(isDefault || !t.frequency ? {} : { window: t.frequency }),
        })}
      />
    </>
  )
}

/** The server's block summary (services/report_blocks.describe), for a template edited in the browser. */
function describeBlocks(blocks = []) {
  return blocks.map((b) => {
    const bd = b.birdy_data || {}
    if (b.type === "data_visualization") return "chart"
    if (["table", "data_table", "carousel"].includes(b.type) && Object.keys(bd).length) return `${b.type} of clients`
    return b.type
  })
}
