"use client"

import { useMemo, useState } from "react"

import { Frame, Input, Label, Notice, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds"
import { patchAgent } from "@/lib/agents-api"
import { BlockFooter } from "./BlockFooter"

export const COMMON_TIMEZONES = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "UTC",
]

const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/** When the daily report is ready: a time and a time zone, saved through patchAgent. */
export function ScheduleBlock({ agent, active, onSend, onSaved }) {
  const [time, setTime] = useState(() => agent?.scope?.schedule?.time ?? "07:00")
  const [tz, setTz] = useState(() => agent?.scope?.schedule?.tz ?? browserZone())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)
  const zones = useMemo(() => (COMMON_TIMEZONES.includes(tz) ? COMMON_TIMEZONES : [tz, ...COMMON_TIMEZONES]), [tz])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      onSaved?.(await patchAgent(agent.id, { scope: { schedule: { time, tz } } }))
      const text = `Report at ${time} ${tz}`
      setSaved(text)
      onSend(text)
    } catch (err) {
      setError(`Couldn't save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-slot="setup-schedule" className="flex flex-col gap-3">
      <Frame title="Report time" titleAs="h3" padded>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="setup-run-time" className="text-xs text-muted-foreground">
              Every day at
            </Label>
            <Input
              id="setup-run-time"
              type="time"
              size="md"
              value={time}
              onChange={(e) => e.target.value && setTime(e.target.value)}
              className="w-36 tabular-nums"
            />
          </div>
          <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
            <Label id="setup-tz-label" className="text-xs text-muted-foreground">
              Time zone
            </Label>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger aria-labelledby="setup-tz-label" className="w-full max-w-64">
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
      </Frame>
      {error && <Notice tone="danger">{error}</Notice>}
      <BlockFooter saved={Boolean(saved)} savedLabel={saved} active={active} saving={saving} onSave={save} label="Save time" />
    </div>
  )
}
