"use client"

import { useMemo, useState } from "react"

import { Frame, Input, Label } from "@/components/ds"
import { ErrorNotice, FALLBACK, SetupFooter, saveMessage, settingsOf } from "./SetupShared"

// `min` is the server's floor. Each of these is a whole number.
const FIELDS = [
  { key: "max_ads_live", label: "Most ads live in one ad set", hint: "Birdy won't add another ad past this.", min: 1 },
  { key: "winner_days", label: "Days an ad must run to be a winner", hint: "It is judged over this many days.", min: 1 },
  { key: "winner_min_leads", label: "Leads an ad needs to be a winner", hint: "Fewer than this and it is too early to call.", min: 0 },
  { key: "revive_after_days", label: "Days before a paused ad can come back", hint: "A paused winner is looked at again after this long.", min: 0 },
  { key: "major_downtrend_pct", label: "Cost per lead rise that counts as a downtrend (%)", hint: "Birdy holds off changes while a client drops by more than this.", min: 0 },
  { key: "auto_max_adds", label: "Most ads Auto can add in one run", hint: "Only matters if you set Add to Auto.", min: 0 },
  { key: "data_window_days", label: "Days of results to read", hint: "The window Birdy compares each client over.", min: 1 },
]

function problem(field, raw) {
  const text = String(raw).trim()
  const n = Number(text)
  if (text === "" || !Number.isFinite(n) || n < field.min || !Number.isInteger(n)) {
    return field.min >= 1 ? "A whole number, 1 or more." : "A whole number, 0 or more."
  }
  return null
}

/** Step 3: the numbers behind removing, adding and reviving ads. Defaults are fine to keep. */
export function SetupCreative({ agent, actions, onBack, onNext }) {
  const stored = useMemo(() => settingsOf(agent).creative, [agent])
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, String(stored[f.key] ?? FALLBACK.creative[f.key])])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const problems = Object.fromEntries(FIELDS.map((f) => [f.key, problem(f, values[f.key])]))
  const blocked = Object.values(problems).some(Boolean)
  const isDefault = FIELDS.every((f) => Number(values[f.key]) === FALLBACK.creative[f.key])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await actions.patchSettings({ settings: { creative: Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key])])) } })
      onNext()
    } catch (err) {
      setError(saveMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Frame
        title="Creative rules"
        description={isDefault ? "These are Birdy's defaults. Keep them or change any." : "You've changed some of Birdy's defaults."}
        padded
        contentClassName="grid grid-cols-1 gap-5 sm:grid-cols-2"
      >
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`stock-creative-${f.key}`}>{f.label}</Label>
            <Input
              id={`stock-creative-${f.key}`}
              inputMode="numeric"
              className="w-28 font-mono"
              value={values[f.key]}
              warning={Boolean(problems[f.key])}
              aria-describedby={`stock-creative-${f.key}-hint`}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
            <p id={`stock-creative-${f.key}-hint`} className={problems[f.key] ? "text-xs text-danger-ink" : "text-xs text-muted-foreground"}>
              {problems[f.key] || f.hint}
            </p>
          </div>
        ))}
      </Frame>
      <ErrorNotice>{error}</ErrorNotice>
      <SetupFooter onBack={onBack} onNext={save} saving={saving} disabled={blocked} />
    </div>
  )
}
