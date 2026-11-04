"use client"

import { useMemo, useState } from "react"

import {
  Button,
  Frame,
  Input,
  Label,
  Notice,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/components/ds"
import { timezoneOptions } from "@/components/reports/report-format"
import { patchAgent } from "@/lib/agents-api"
import { ErrorNotice, SetupFooter, WEEKDAYS, saveMessage, settingsOf } from "./SetupShared"

/**
 * The agent checks every 15 minutes and starts the day's run at the first check after the chosen time.
 * The last check of a day is 23:45, so a later time never comes due. The picker stops at 23:30 so one
 * late check doesn't lose the whole day.
 */
export const LATEST_RUN_TIME = "23:30"

/** Why a run time is refused, or null. */
export function timeProblem(time) {
  if (!/^\d{2}:\d{2}$/.test(time ?? "")) return "Pick a time of day."
  if (time > LATEST_RUN_TIME) {
    return `Birdy checks every 15 minutes and the last check of the day is 23:45, so a run set for ${time} could miss the day. Pick ${LATEST_RUN_TIME} or earlier.`
  }
  return null
}

/** Step 1: the time and zone the run starts, which weekdays each batch runs, and the weekly message. */
export function SetupSchedule({ agent, actions, onNext, saveLabel, inPlace = false }) {
  const settings = useMemo(() => settingsOf(agent), [agent])
  const [time, setTime] = useState(agent.scope?.schedule?.time ?? "07:00")
  const [tz, setTz] = useState(agent.scope?.schedule?.tz ?? "Europe/London")
  const [batches, setBatches] = useState(settings.batches)
  const [weekly, setWeekly] = useState(settings.weekly)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const timeError = timeProblem(time)
  const noDays = !batches.some((b) => b.weekdays.length > 0)
  const zones = timezoneOptions(tz)

  const toggleDay = (batchId, day) =>
    setBatches((list) =>
      list.map((b) =>
        b.id !== batchId
          ? b
          : { ...b, weekdays: b.weekdays.includes(day) ? b.weekdays.filter((d) => d !== day) : [...b.weekdays, day].sort() }
      )
    )

  // The time and zone live on the agent and the days and weekly message in its settings, so this is two
  // requests and not atomic: if the second fails, the time is already saved and the message says so.
  // A live agent re-checks its client claims on every scope patch, so in settings the scope is only sent when it changes. Setup always sends it.
  const savedTime = agent.scope?.schedule?.time ?? "07:00"
  const savedTz = agent.scope?.schedule?.tz ?? "Europe/London"
  const save = async () => {
    setSaving(true)
    setError(null)
    let scopeSaved = false
    try {
      if (!inPlace || time !== savedTime || tz !== savedTz) {
        await patchAgent(agent.id, { scope: { schedule: { time, tz } } })
        scopeSaved = true
      }
      await actions.patchSettings({ settings: { batches, weekly: { enabled: Boolean(weekly.enabled), weekday: weekly.weekday ?? 0 } } })
      onNext()
      // Setup moves to the next step, so the button stays busy until the page changes; in settings it is done.
      if (inPlace) setSaving(false)
    } catch (err) {
      setError(scopeSaved ? `${saveMessage(err)} The time and time zone were saved, but the days and weekly message weren't.` : saveMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Frame title="When should it check?" description="The morning run starts at the first check after this time." padded contentClassName="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stock-run-time" className="text-xs text-muted-foreground">
              Every day at
            </Label>
            <Input
              id="stock-run-time"
              type="time"
              size="md"
              max={LATEST_RUN_TIME}
              value={time}
              warning={Boolean(timeError)}
              aria-invalid={Boolean(timeError) || undefined}
              onChange={(e) => e.target.value && setTime(e.target.value)}
              className="w-44 font-mono"
            />
          </div>
          <div className="flex min-w-0 flex-1 basis-52 flex-col gap-1.5">
            <Label id="stock-tz-label" className="text-xs text-muted-foreground">
              Time zone
            </Label>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger aria-labelledby="stock-tz-label" className="w-full max-w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {timeError ? (
          <p role="alert" className="text-xs text-danger-ink">
            {timeError}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Birdy checks every 15 minutes, so the latest time you can pick is {LATEST_RUN_TIME}.
          </p>
        )}
      </Frame>

      <Frame
        title="Which days does each batch run?"
        description="A batch day runs a full report for that batch's clients. Every other day Birdy only checks for problems."
        padded
        contentClassName="flex flex-col gap-4"
      >
        {batches.map((b) => (
          <div key={b.id} role="group" aria-label={`${b.name} days`} className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-sm font-medium text-foreground">{b.name}</span>
            {WEEKDAYS.map((label, day) => {
              const on = b.weekdays.includes(day)
              return (
                <Button
                  key={label}
                  size="sm"
                  variant={on ? "primary" : "outline"}
                  aria-pressed={on}
                  aria-label={`${b.name} ${label}`}
                  onClick={() => toggleDay(b.id, day)}
                >
                  {label}
                </Button>
              )
            })}
          </div>
        ))}
        {noDays && <Notice tone="warning">Pick at least one day, or no report will ever run.</Notice>}
      </Frame>

      <Frame title="Weekly message" description="A short wrap-up of the week, ready to post to Slack." padded contentClassName="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="stock-weekly"
            checked={Boolean(weekly.enabled)}
            onCheckedChange={(enabled) => setWeekly((w) => ({ ...w, enabled }))}
          />
          <Label htmlFor="stock-weekly">Prepare a weekly message</Label>
        </div>
        {weekly.enabled && (
          <div className="flex items-center gap-2">
            <Label id="stock-weekly-day" className="text-sm text-muted-foreground">
              Every
            </Label>
            <Select value={String(weekly.weekday ?? 0)} onValueChange={(v) => setWeekly((w) => ({ ...w, weekday: Number(v) }))}>
              <SelectTrigger aria-labelledby="stock-weekly-day" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((label, day) => (
                  <SelectItem key={label} value={String(day)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </Frame>

      <ErrorNotice>{error}</ErrorNotice>
      <SetupFooter onNext={save} saving={saving} disabled={Boolean(timeError) || noDays} label={saveLabel} />
    </div>
  )
}
