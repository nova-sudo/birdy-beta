"use client"

// components/settings/GeneralSettings.jsx
// The Settings General tab: account fields, password, and how often Birdy
// sends the Slack brief.
//
// This tab shipped as a literal placeholder — "General settings content goes
// here" — because none of it had anywhere to save. The endpoints exist now
// (GET/PATCH /api/user/profile, POST /api/user/password); this is the form.

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { apiRequest } from "@/lib/api"
import { STORAGE_KEYS } from "@/lib/constants"

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

export function GeneralSettings({ slackConnected = false, brief, onBriefSaved }) {
  const [profile, setProfile] = useState(null)
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

  useEffect(() => {
    let cancelled = false
    apiRequest("/api/user/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setProfile(data)
        setName(data.name || "")
        setCurrency(data.default_currency || "USD")
        setTimezone(data.timezone || "")
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
    <div className="space-y-6">
      {/* Account and password sit side by side, as the design draws them. */}
      <div className="grid gap-[18px] lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General settings</CardTitle>
            <CardDescription>
              Manage your general application and account settings
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 pt-4">
            <div>
              <Label htmlFor="account-name" className="text-xs font-semibold">Name</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="mt-1.5 h-[38px] text-[13px]"
              />
            </div>

            <div>
              <Label htmlFor="account-email" className="text-xs font-semibold">Email</Label>
              <Input
                id="account-email"
                value={profile?.email ?? ""}
                readOnly
                disabled
                className="mt-1.5 h-[38px] text-[13px]"
              />
              {/* Not an oversight: the account id IS the email, so changing it
                  would rekey every document that references the account. */}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Your email is your account identifier and cannot be changed here.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="mt-1.5 h-[38px] text-[13px]">
                    <SelectValue placeholder="Select a timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="mt-1.5 h-[38px] text-[13px]">
                    <SelectValue placeholder="Select a currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={saveProfile}
              disabled={!dirty || savingProfile}
              className="w-fit bg-[#6B4EE6] text-white hover:bg-[#5B3FD6]"
            >
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Password</CardTitle>
            <CardDescription>Change your account password</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            <form onSubmit={savePassword} className="space-y-4">
              <div>
                <Label htmlFor="current-password" className="text-xs font-semibold">
                  Current password
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="mt-1.5 h-[38px] text-[13px]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="new-password" className="text-xs font-semibold">
                    New password
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    className="mt-1.5 h-[38px] text-[13px]"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password" className="text-xs font-semibold">
                    Confirm new password
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="mt-1.5 h-[38px] text-[13px]"
                  />
                </div>
              </div>

              {passwordError && (
                <p className="text-[11px] text-destructive">{passwordError}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                At least 8 characters, and different from your current one.
              </p>

              <Button
                type="submit"
                disabled={!current || !next || !confirm || savingPassword}
                className="w-fit bg-[#6B4EE6] text-white hover:bg-[#5B3FD6]"
              >
                {savingPassword ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-[900px]">
        <CardHeader>
          <CardTitle className="text-base">Notification preferences</CardTitle>
          <CardDescription>How often Birdy sends your Slack brief</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          {!slackConnected ? (
            <p className="text-sm text-muted-foreground">
              Connect the Slack bot under Integrations to schedule a brief.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
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
                      className={`rounded-[10px] border-2 p-4 text-left transition ${
                        active
                          ? "border-[#6B4EE6] bg-[#F1EEFC]"
                          : "border-border hover:border-[#CFCFDA]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-foreground">{option.title}</p>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </button>
                  )
                })}
              </div>

              {/* Revealed beneath, in the same card, as the design specifies —
                  and deliberately not auto-advancing, so a mind can change
                  before anything is saved. */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {frequency === "weekly" && (
                  <div>
                    <Label className="text-xs font-semibold">Which day?</Label>
                    <Select value={briefDay} onValueChange={setBriefDay}>
                      <SelectTrigger className="mt-1.5 h-[38px] text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className={frequency === "weekly" ? "" : "max-w-[220px]"}>
                  <Label className="text-xs font-semibold">What time?</Label>
                  <Select value={briefTime} onValueChange={setBriefTime}>
                    <SelectTrigger className="mt-1.5 h-[38px] text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BRIEF_TIMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={saveBrief}
                disabled={savingBrief}
                className="mt-4 w-fit bg-[#6B4EE6] text-white hover:bg-[#5B3FD6]"
              >
                {savingBrief ? "Saving…" : "Save schedule"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
