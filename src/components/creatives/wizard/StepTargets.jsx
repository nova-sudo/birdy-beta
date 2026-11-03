"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import {
  Button,
  Checkbox,
  Frame,
  Input,
  Label,
  Notice,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Surface,
} from "@/components/ds"
import { currencySymbol } from "@/lib/chat-viz"
import { useCreativeAdAccounts, useCreativeTargetsPrefill } from "@/lib/creatives-api"

export const DEFAULT_TARGETS = { mode: "thresholds", metrics: {}, baseline_pct: 15, min_spend: 150, min_days: 7, win_share: 0.6 }
export const DEFAULT_ON_VERDICT = { notify_channels: ["in_app"], suggest_pause_failing: true, auto_pause_losers: false }

const MODES = [
  { value: "thresholds", title: "Targets per metric", hint: "Absolute thresholds, prefilled from each client's defaults." },
  { value: "baseline", title: "Beat the account", hint: "Winner if it beats that account's own CPL (and CTR) by N%." },
  { value: "cpl_only", title: "CPL only", hint: "One CPL number, nothing else." },
]

const METRIC_ROWS = [
  { key: "cpl", label: "Cost per lead", op: "lte", opLabel: "≤", unit: "money" },
  { key: "ctr", label: "CTR (link)", op: "gte", opLabel: "≥", unit: "%" },
  { key: "cpc", label: "Cost per click", op: "lte", opLabel: "≤", unit: "money" },
  { key: "hook_rate", label: "Hook rate (3s views ÷ impressions)", op: "gte", opLabel: "≥", unit: "%" },
  { key: "leads", label: "Leads", op: "gte", opLabel: "≥", unit: "" },
]

const SOURCE_LABELS = { client: "client default", agency: "agency default" }

const numberOrNull = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v))
const positive = (v) => v != null && Number.isFinite(Number(v)) && Number(v) > 0

/** Whether "Continue" is allowed on step 3: the chosen mode has the numbers it needs. */
export function targetsStepValid(draft) {
  const t = draft?.targets
  if (!t) return false
  const metrics = t.metrics ?? {}
  if (!positive(t.min_spend) || !positive(t.min_days) || !(t.win_share > 0 && t.win_share <= 1)) return false
  if (t.mode === "baseline") return positive(t.baseline_pct)
  if (t.mode === "cpl_only") return positive(metrics.cpl?.value)
  const on = Object.values(metrics)
  return on.length > 0 && on.every((m) => positive(m?.value) || m?.value === 0)
}

function accountLabel(account, row) {
  const names = (account?.clients ?? []).map((c) => c.name).filter(Boolean)
  return names.length ? names.join(", ") : account?.name || row.ad_account_id
}

/**
 * Wizard step 3: how a winner is judged. Writes `targets` and `on_verdict` on the draft; per-account CPL
 * overrides go on the account rows as `targets_override`.
 *
 * @param {object} props
 * @param {object} props.draft From `useCreativeDraft`
 * @param {(path: string, value: any) => void} props.setField
 * @param {boolean} [props.allowOverrides=true] Overrides ride on the Post call, so they are off for a posted test
 */
export function StepTargets({ draft, setField, allowOverrides = true }) {
  const rows = draft.creative?.accounts ?? []
  const groupIds = rows.map((r) => r.client_group_id)
  const { prefill, isLoading: prefillLoading } = useCreativeTargetsPrefill(groupIds)
  const { accounts } = useCreativeAdAccounts()
  const isImage = draft.creative?.format === "image"
  const [drawer, setDrawer] = useState(false)
  const thresholdsRef = useRef(null) // thresholds the user had before switching mode

  const targets = draft.targets ?? DEFAULT_TARGETS
  const metrics = targets.metrics ?? {}
  const onVerdict = { ...DEFAULT_ON_VERDICT, ...(draft.on_verdict ?? {}) }
  const prefillCpl = prefill?.metrics?.cpl

  // First visit: write the defaults, with the CPL target the clients already have. A resumed draft holds the
  // server's empty thresholds, so those get the prefill too.
  const seeded = useRef(false)
  const isDraft = !draft.status || draft.status === "draft"
  useEffect(() => {
    if (seeded.current || prefillLoading) return
    const empty = draft.targets?.mode === "thresholds" && Object.keys(draft.targets.metrics ?? {}).length === 0
    if (draft.targets && !(empty && isDraft)) return
    seeded.current = true
    const cpl = prefillCpl?.value != null ? { cpl: { op: "lte", value: prefillCpl.value, source: prefillCpl.source } } : {}
    setField("targets", { ...DEFAULT_TARGETS, ...(draft.targets ?? {}), metrics: cpl })
  }, [draft.targets, isDraft, prefillLoading, prefillCpl, setField])

  // The verdict actions are stored whether or not they are touched, so the screen matches what is saved.
  const seededVerdict = useRef(false)
  useEffect(() => {
    if (seededVerdict.current || draft.on_verdict) return
    seededVerdict.current = true
    setField("on_verdict", DEFAULT_ON_VERDICT)
  }, [draft.on_verdict, setField])

  const write = (patch) => setField("targets", { ...targets, ...patch })
  const writeMetric = (key, spec) => {
    const next = { ...metrics }
    if (spec) next[key] = spec
    else delete next[key]
    write({ metrics: next })
  }

  function switchMode(mode) {
    if (mode === targets.mode) return
    if (targets.mode === "thresholds") thresholdsRef.current = metrics
    const cpl = metrics.cpl ?? (prefillCpl?.value != null ? { op: "lte", value: prefillCpl.value, source: prefillCpl.source } : undefined)
    if (mode === "thresholds") write({ mode, metrics: thresholdsRef.current ?? (cpl ? { cpl } : {}) })
    else if (mode === "cpl_only") write({ mode, metrics: cpl ? { cpl } : {} })
    else write({ mode, metrics: {} })
  }

  const toggleChannel = (channel, on) => {
    const set = new Set(onVerdict.notify_channels ?? [])
    if (on) set.add(channel)
    else set.delete(channel)
    setField("on_verdict", { ...onVerdict, notify_channels: [...set] })
  }

  const accountById = useMemo(() => Object.fromEntries(accounts.map((a) => [a.ad_account_id, a])), [accounts])
  // Mixed currencies: a test-level amount has no single symbol, so each account reads it in its own currency.
  const currencies = new Set(rows.map((r) => accountById[r.ad_account_id]?.currency).filter(Boolean))
  const mixed = currencies.size > 1
  const testSymbol = mixed ? "" : currencySymbol([...currencies][0])
  const testCpl = metrics.cpl?.value ?? prefillCpl?.value ?? null
  const resolved = (row) => row.targets_override?.cpl ?? prefill?.per_account?.[row.client_group_id]?.cpl ?? testCpl
  const ownTargets = rows.filter((r) => prefill?.per_account?.[r.client_group_id]?.cpl != null).length

  const setOverride = (act, value) =>
    setField(
      "creative.accounts",
      rows.map((r) => {
        if (r.ad_account_id !== act) return r
        const { targets_override: _drop, ...rest } = r
        return value == null ? rest : { ...rest, targets_override: { cpl: value } }
      })
    )

  const ops = (key) => (key === "hook_rate" && isImage ? "video only" : SOURCE_LABELS[metrics[key]?.source] ?? "")
  const currencyNote = mixed ? "in each account's currency" : null

  return (
    <Frame title="Targets" description="How should Birdy judge a winner?" padded>
      <div className="flex flex-col gap-5">
        <div role="radiogroup" aria-label="Judging mode" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={targets.mode === m.value}
              onClick={() => switchMode(m.value)}
              className="rounded-frame border border-border p-3 text-left text-sm transition-colors hover:bg-muted/50 aria-checked:border-foreground aria-checked:bg-muted/60"
            >
              <span className="block font-medium">{m.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{m.hint}</span>
            </button>
          ))}
        </div>

        {targets.mode === "thresholds" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              An account passes when every enabled metric is met.{currencyNote ? ` Amounts are ${currencyNote}.` : ""}
            </p>
            {METRIC_ROWS.map((m) => {
              const disabled = m.key === "hook_rate" && isImage
              const spec = metrics[m.key]
              const on = !!spec && !disabled
              const prefix = m.unit === "money" ? testSymbol : ""
              return (
                <div key={m.key} data-testid={`metric-${m.key}`} className="flex flex-wrap items-center gap-3">
                  <label className="flex min-w-48 flex-1 items-center gap-2 text-sm">
                    <Checkbox
                      checked={on}
                      disabled={disabled}
                      aria-label={`Use ${m.label}`}
                      onCheckedChange={(v) => writeMetric(m.key, v === true ? { op: m.op, value: null } : null)}
                    />
                    {m.label}
                  </label>
                  <span className="w-4 text-center text-sm text-muted-foreground">{m.opLabel}</span>
                  <div className="flex items-center gap-1">
                    {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
                    <Input
                      size="sm"
                      type="number"
                      min="0"
                      step="any"
                      className="w-24"
                      aria-label={`${m.label} target`}
                      disabled={!on}
                      value={spec?.value ?? ""}
                      onChange={(e) => writeMetric(m.key, { op: m.op, value: numberOrNull(e.target.value) })}
                    />
                    {m.unit === "%" && <span className="text-sm text-muted-foreground">%</span>}
                  </div>
                  <span className="w-28 text-xs text-muted-foreground">{ops(m.key)}</span>
                </div>
              )
            })}
          </div>
        )}

        {targets.mode === "baseline" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="baseline-pct">Beat the account's own CPL by</Label>
              <Input
                id="baseline-pct"
                size="sm"
                type="number"
                min="0"
                className="w-20"
                value={targets.baseline_pct ?? ""}
                onChange={(e) => write({ baseline_pct: numberOrNull(e.target.value) })}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!metrics.ctr}
                aria-label="Also require CTR"
                onCheckedChange={(v) => writeMetric("ctr", v === true ? { op: "gte" } : null)}
              />
              Also require CTR to beat the account's by the same margin
            </label>
          </div>
        )}

        {targets.mode === "cpl_only" && (
          <div className="flex items-center gap-2">
            <Label htmlFor="cpl-only">Cost per lead at most</Label>
            <span className="text-sm text-muted-foreground">{testSymbol}</span>
            <Input
              id="cpl-only"
              size="sm"
              type="number"
              min="0"
              step="any"
              className="w-28"
              value={metrics.cpl?.value ?? ""}
              onChange={(e) => writeMetric("cpl", { op: "lte", value: numberOrNull(e.target.value) })}
            />
            {currencyNote && <span className="text-xs text-muted-foreground">{currencyNote}</span>}
            {SOURCE_LABELS[metrics.cpl?.source] && <span className="text-xs text-muted-foreground">{SOURCE_LABELS[metrics.cpl.source]}</span>}
          </div>
        )}

        {allowOverrides && rows.length > 0 && targets.mode !== "baseline" && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {ownTargets > 0 ? `${ownTargets} ${ownTargets === 1 ? "account has" : "accounts have"} their own CPL target. ` : ""}
              Birdy uses a client's own CPL target for its rows.
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDrawer(true)}>
              Edit per account
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="min-spend">Score each account after</Label>
            <div className="flex items-center gap-2">
              <Input id="min-spend" size="sm" type="number" min="0" aria-label="Minimum spend" value={targets.min_spend ?? ""} onChange={(e) => write({ min_spend: numberOrNull(e.target.value) })} />
              <span className="text-sm text-muted-foreground">spend</span>
              <Input size="sm" type="number" min="0" aria-label="Minimum days" value={targets.min_days ?? ""} onChange={(e) => write({ min_days: numberOrNull(e.target.value) })} />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground">Whichever comes first. Below this, Birdy says "scoring", never pass or fail.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="win-share">Call the test a winner when</Label>
            <div className="flex items-center gap-2">
              <Input
                id="win-share"
                size="sm"
                type="number"
                min="1"
                max="100"
                value={targets.win_share == null ? "" : Math.round(targets.win_share * 100)}
                onChange={(e) => write({ win_share: numberOrNull(e.target.value) == null ? null : Number(e.target.value) / 100 })}
              />
              <span className="text-sm text-muted-foreground">% of scored accounts pass</span>
            </div>
            <p className="text-xs text-muted-foreground">Loser when that share fails. Otherwise "inconclusive". Needs at least 2 scored accounts.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>When a verdict lands</Label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={(onVerdict.notify_channels ?? []).includes("in_app")} onCheckedChange={(v) => toggleChannel("in_app", v === true)} aria-label="Notify in-app" />
            Notify in-app
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={(onVerdict.notify_channels ?? []).includes("slack")} onCheckedChange={(v) => toggleChannel("slack", v === true)} aria-label="Notify in Slack" />
            Notify in Slack
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={!!onVerdict.suggest_pause_failing} onCheckedChange={(v) => setField("on_verdict", { ...onVerdict, suggest_pause_failing: v === true })} aria-label="Suggest pausing failing accounts" />
            Suggest pausing failing accounts
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={!!onVerdict.auto_pause_losers} onCheckedChange={(v) => setField("on_verdict", { ...onVerdict, auto_pause_losers: v === true })} aria-label="Auto-pause losers" />
            Auto-pause losers (agent rule)
          </label>
        </div>
      </div>

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent size="md">
          <SheetHeader>
            <SheetTitle>CPL target per account</SheetTitle>
            <SheetDescription>Leave blank to use the client's own target, or the test's.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className="flex flex-col gap-3">
              {rows.map((row) => {
                const account = accountById[row.ad_account_id]
                const label = accountLabel(account, row)
                const symbol = currencySymbol(account?.currency)
                const value = resolved(row)
                return (
                  <Surface key={row.ad_account_id} className="flex items-center gap-3 p-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">
                        {value != null ? `Resolved CPL ≤ ${symbol}${value}` : "No CPL target"}
                        {row.targets_override?.cpl != null ? " · override" : ""}
                      </span>
                    </div>
                    <Input
                      size="sm"
                      type="number"
                      min="0"
                      step="any"
                      className="w-24"
                      aria-label={`CPL override for ${label}`}
                      placeholder={value != null ? String(value) : "—"}
                      value={row.targets_override?.cpl ?? ""}
                      onChange={(e) => setOverride(row.ad_account_id, numberOrNull(e.target.value))}
                    />
                  </Surface>
                )
              })}
              {rows.length === 0 && <Notice tone="warning">Choose accounts first.</Notice>}
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </Frame>
  )
}
