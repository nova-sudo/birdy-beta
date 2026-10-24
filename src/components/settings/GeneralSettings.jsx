"use client"

// components/settings/GeneralSettings.jsx
// The Settings General tab: account fields, password, and the Slack report:
// its schedule here, its contents through the report copilot (SavedReportCard).
//
// This tab shipped as a literal placeholder — "General settings content goes
// here" — because none of it had anywhere to save. The endpoints exist now
// (GET/PATCH /api/user/profile, POST /api/user/password); this is the form.
//
// Each form saves on its own button, at the bottom-right of its Frame.

import { useCallback, useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { toast } from "sonner"
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Notice,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ds"
import { apiRequest } from "@/lib/api"
import { STORAGE_KEYS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import SavedReportCard from "@/components/report-designer/SavedReportCard"
import { FrameFooter, SettingBlock, SettingRow, SettingsFrame } from "./SettingsFrame"

// Kept short and ordered by likelihood rather than listing every ISO code —
// the agencies on this product bill in a handful of currencies.
const CURRENCIES = [
  { code: "GBP", label: "GBP (£)" },
  { code: "USD", label: "USD ($)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "AED", label: "AED" },
  { code: "CAD", label: "CAD ($)" },
  { code: "AUD", label: "AUD ($)" },
]

// Intl.supportedValuesOf is not available everywhere, so the common zones are
// listed and whatever the user already has is merged in below.
const TIMEZONES = [
  "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Australia/Sydney", "UTC",
]

const BRIEF_TIMES = [
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "12:00 PM", "5:00 PM",
]
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

// Controls sit at 360px on the right of a row, or fill it below md.
const CONTROL = "w-full md:w-90"

export function GeneralSettings({ slackConnected = false, brief, onBriefSaved }) {
  const [profile, setProfile] = useState(null)
  const [profileFailed, setProfileFailed] = useState(false)
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("")
  const [timezone, setTimezone] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)

  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")

  const [frequency, setFrequency] = useState(brief?.frequency ?? "daily")
  const [briefTime, setBriefTime] = useState(brief?.time ?? "9:00 AM")
  const [briefDay, setBriefDay] = useState(brief?.day ?? "Monday")
  const [savingBrief, setSavingBrief] = useState(false)

  const loadProfile = useCallback(() => {
    let cancelled = false
    setProfileFailed(false)
    apiRequest("/api/user/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setProfileFailed(true)
          return
        }
        setProfile(data)
        setName(data.name || "")
        setCurrency(data.default_currency || "USD")
        setTimezone(data.timezone || "")
      })
      .catch(() => { if (!cancelled) setProfileFailed(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => loadProfile(), [loadProfile])

  useEffect(() => {
    if (!brief) return
    setFrequency(brief.frequency ?? "daily")
    setBriefTime(brief.time ?? "9:00 AM")
    setBriefDay(brief.day ?? "Monday")
  }, [brief])

  const dirty =
    profile &&
    (name !== (profile.name || "") ||
      currency !== (profile.default_currency || "USD") ||
      timezone !== (profile.timezone || ""))

  const saveProfile = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Name cannot be empty")
      return
    }
    setSavingProfile(true)
    try {
      const res = await apiRequest("/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          default_currency: currency,
          timezone,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setProfile((prev) => ({
        ...prev, name: name.trim(), default_currency: currency, timezone,
      }))
      // Currency is cached for the pages that format money before the profile
      // request lands; a stale copy would relabel every figure on screen.
      try { localStorage.setItem(STORAGE_KEYS.DEFAULT_CURRENCY, currency) } catch {}
      toast.success("Settings saved")
    } catch {
      toast.error("Could not save settings")
    } finally {
      setSavingProfile(false)
    }
  }, [name, currency, timezone])

  const savePassword = useCallback(async (e) => {
    e.preventDefault()
    setPasswordError("")
    if (next !== confirm) {
      setPasswordError("The two new passwords do not match")
      return
    }
    setSavingPassword(true)
    try {
      const res = await apiRequest("/api/user/password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || "Could not change password")
      }
      setCurrent(""); setNext(""); setConfirm("")
      toast.success("Password updated")
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setSavingPassword(false)
    }
  }, [current, next, confirm])

  const saveBrief = useCallback(async () => {
    setSavingBrief(true)
    try {
      const res = await apiRequest("/api/integrations/slack/brief", {
        method: "PUT",
        body: JSON.stringify({
          frequency,
          time: briefTime,
          day: frequency === "weekly" ? briefDay : null,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      onBriefSaved?.(data.brief)
      toast.success("Brief schedule saved")
    } catch {
      toast.error("Could not save the brief schedule")
    } finally {
      setSavingBrief(false)
    }
  }, [frequency, briefTime, briefDay, onBriefSaved])

  const timezoneOptions = timezone && !TIMEZONES.includes(timezone)
    ? [timezone, ...TIMEZONES]
    : TIMEZONES

  return (
    <div className="flex flex-col gap-4">
      <SettingsFrame
        title="General settings"
        description="Manage your general application and account settings"
      >
        {profileFailed && (
          <SettingBlock>
            <ErrorState
              title="Couldn't load your profile"
              description="Your account details are unchanged; we just couldn't fetch them."
              onRetry={loadProfile}
            />
          </SettingBlock>
        )}

        <SettingRow label="Name" htmlFor="account-name">
          <Input
            id="account-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className={CONTROL}
          />
        </SettingRow>

        {/* Not an oversight: the account id IS the email, so changing it
            would rekey every document that references the account. */}
        <SettingRow
          label="Email"
          htmlFor="account-email"
          description="Your email is your account identifier and cannot be changed here."
        >
          <Input
            id="account-email"
            value={profile?.email ?? ""}
            readOnly
            disabled
            className={CONTROL}
          />
        </SettingRow>

        <SettingRow label="Timezone" htmlFor="account-timezone">
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="account-timezone" className={CONTROL}>
              <SelectValue placeholder="Select a timezone" />
            </SelectTrigger>
            <SelectContent>
              {timezoneOptions.map((tz) => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow label="Currency" htmlFor="account-currency">
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="account-currency" className={CONTROL}>
              <SelectValue placeholder="Select a currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <FrameFooter>
          <Button variant="primary" onClick={saveProfile} disabled={!dirty || savingProfile}>
            {savingProfile ? "Saving…" : "Save changes"}
          </Button>
        </FrameFooter>
      </SettingsFrame>

      <form onSubmit={savePassword}>
        <SettingsFrame title="Password" description="Change your account password">
          <SettingRow label="Current password" htmlFor="current-password">
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={CONTROL}
            />
          </SettingRow>

          <SettingRow
            label="New password"
            htmlFor="new-password"
            description="At least 8 characters, and different from your current one."
          >
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={CONTROL}
            />
          </SettingRow>

          <SettingRow label="Confirm new password" htmlFor="confirm-password">
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={CONTROL}
            />
          </SettingRow>

          {passwordError && (
            <SettingBlock>
              <Notice tone="danger">{passwordError}</Notice>
            </SettingBlock>
          )}

          <FrameFooter>
            <Button
              type="submit"
              variant="primary"
              disabled={!current || !next || !confirm || savingPassword}
            >
              {savingPassword ? "Updating…" : "Update password"}
            </Button>
          </FrameFooter>
        </SettingsFrame>
      </form>

      <SettingsFrame
        title="Notification preferences"
        description="When Birdy sends your Slack report, and what's in it"
      >
        {!slackConnected ? (
          <EmptyState
            icon={Bell}
            title="Connect the Slack bot under Integrations to schedule a brief."
          />
        ) : (
          <>
            <SettingBlock>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: "daily", title: "Daily", desc: "A summary every morning" },
                  { key: "weekly", title: "Weekly", desc: "One digest each Monday" },
                ].map((option) => {
                  const active = frequency === option.key
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setFrequency(option.key)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-control p-3 text-left outline-none transition-shadow focus-visible:shadow-control-focus",
                        active
                          ? "bg-primary-soft ring-2 ring-primary"
                          : "bg-background shadow-control hover:bg-muted"
                      )}
                    >
                      <p className="text-sm font-semibold text-foreground">{option.title}</p>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </button>
                  )
                })}
              </div>
            </SettingBlock>

            {/* Revealed beneath, in the same Frame, as the design specifies —
                and deliberately not auto-advancing, so a mind can change
                before anything is saved. */}
            {frequency === "weekly" && (
              <SettingRow label="Which day?" htmlFor="brief-day">
                <Select value={briefDay} onValueChange={setBriefDay}>
                  <SelectTrigger id="brief-day" className={CONTROL}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </SettingRow>
            )}
            <SettingRow label="What time?" htmlFor="brief-time">
              <Select value={briefTime} onValueChange={setBriefTime}>
                <SelectTrigger id="brief-time" className={CONTROL}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRIEF_TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </SettingRow>

            <FrameFooter>
              <Button variant="primary" onClick={saveBrief} disabled={savingBrief}>
                {savingBrief ? "Saving…" : "Save schedule"}
              </Button>
            </FrameFooter>

            <SettingBlock>
              <SavedReportCard brief={brief} onSaved={onBriefSaved} />
            </SettingBlock>
          </>
        )}
      </SettingsFrame>
    </div>
  )
}
