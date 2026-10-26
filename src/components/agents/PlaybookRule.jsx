"use client"

import * as React from "react"
import { Pause, RefreshCw, TrendingDown, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input, SegmentedTabs, Switch } from "@/components/ds"

/**
 * Each rule as a sentence. A part is either text or a param slot:
 * `{ key, label, money?, suffix? }`. `label` is the input's accessible name.
 */
export const RULE_COPY = {
  pause_over_target: {
    title: "Pause ads over target",
    icon: Pause,
    chip: "bg-danger-soft text-danger-ink",
    parts: [
      "After ",
      { key: "patience_spend", label: "Spend before judging", money: true },
      " or ",
      { key: "patience_days", label: "Days before judging", suffix: "days" },
      ", CPL over ",
      { key: "cpl_multiple", label: "CPL multiple of target", suffix: "×", step: "0.1" },
      " target, or 0 leads after ",
      { key: "zero_lead_spend", label: "Spend with no leads", money: true },
      ".",
    ],
  },
  revive_winner: {
    title: "Revive old winners",
    icon: RefreshCw,
    chip: "bg-success-soft text-success-ink",
    parts: [
      "After ",
      { key: "min_paused_days", label: "Days paused", suffix: "days" },
      " off, if it beat target, creative under ",
      { key: "max_creative_age_days", label: "Max creative age in days", suffix: "days" },
      " old.",
    ],
  },
  flag_no_spend: {
    title: "Flag no spend",
    icon: TriangleAlert,
    chip: "bg-warning-soft text-warning-ink",
    parts: ["Live ad set with no spend for ", { key: "hours", label: "Hours with no spend", suffix: "hrs" }, "."],
  },
  flag_declining: {
    title: "Flag declining performance",
    icon: TrendingDown,
    chip: "bg-warning-soft text-warning-ink",
    parts: [
      "CPL up ",
      { key: "pct_rise", label: "CPL rise percent", suffix: "%" },
      " week on week, with at least ",
      { key: "min_leads", label: "Minimum leads", suffix: "leads" },
      ".",
    ],
  },
}

const MODE_ITEMS = [
  { value: "flag", label: "Flag only" },
  { value: "ask", label: "Ask me" },
  { value: "auto", label: "Auto-run", disabled: true, tooltip: "Earned after 10 approvals in a row" },
]

const fmt = (n) => (n == null || Number.isNaN(Number(n)) ? "" : String(n))

/**
 * A number inside the sentence. Commits on blur or Enter; Escape puts the saved value back. An
 * empty, negative or unchanged value sends nothing.
 */
function InlineValue({ value, label, money, suffix, step, currency, onCommit }) {
  const [draft, setDraft] = React.useState(fmt(value))
  const baseline = React.useRef(value)

  React.useEffect(() => {
    baseline.current = value
    setDraft(fmt(value))
  }, [value])

  const commit = () => {
    const n = Number(draft)
    if (draft.trim() === "" || !Number.isFinite(n) || n < 0) {
      setDraft(fmt(baseline.current))
      return
    }
    if (n === Number(baseline.current)) return
    baseline.current = n
    onCommit(n)
  }

  return (
    <span className="mx-0.5 inline-flex items-center gap-1 align-middle whitespace-nowrap">
      {money && <span className="text-sm text-muted-foreground">{currency}</span>}
      <Input
        size="sm"
        inputMode="decimal"
        aria-label={label}
        value={draft}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          } else if (e.key === "Escape") {
            setDraft(fmt(baseline.current))
          }
        }}
        className="h-7 w-14 px-2 text-right font-mono text-sm"
      />
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
    </span>
  )
}

function StaticValue({ value, money, suffix, currency }) {
  return (
    <span className="mx-0.5 rounded-sm bg-primary-soft px-1.5 py-px font-mono text-sm text-primary">
      {money ? currency : ""}
      {fmt(value)}
      {suffix ? (suffix === "×" || suffix === "%" ? suffix : ` ${suffix}`) : ""}
    </span>
  )
}

/**
 * One playbook rule: its title and on/off switch, the rule as a sentence with editable values, and
 * the mode ladder. Auto-run is never chosen here; it is earned (see Task 17).
 *
 * @param {object} props
 * @param {{id: string, kind: string, enabled: boolean, mode: "flag"|"ask"|"auto", params: object}} props.rule
 * @param {(patch: {params?: object, mode?: string, enabled?: boolean}) => void} props.onChange
 * @param {boolean} [props.showMode=true]
 * @param {boolean} [props.editable=true]
 * @param {string} [props.currency="$"] Symbol for money values (the watched clients' account currency)
 * @param {number} [props.hits] Times the rule fired in the dry run
 */
export function PlaybookRule({ rule, onChange, showMode = true, editable = true, currency = "$", hits, className }) {
  const copy = RULE_COPY[rule.kind]
  if (!copy) return null
  const Icon = copy.icon
  const params = rule.params ?? {}

  return (
    <div data-slot="playbook-rule" data-kind={rule.kind} className={cn("flex flex-col gap-2.5 p-4", className)}>
      <div className="flex items-center gap-2">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", copy.chip)} aria-hidden>
          <Icon className="size-3.5" strokeWidth={2.5} />
        </span>
        <h3 className="min-w-0 flex-1 text-base font-medium text-foreground">{copy.title}</h3>
        {editable && (
          <Switch
            checked={rule.enabled !== false}
            onCheckedChange={(enabled) => onChange({ enabled })}
            aria-label={`${copy.title} on`}
          />
        )}
      </div>

      <p className={cn("text-base leading-8 text-ink-secondary", rule.enabled === false && "opacity-60")}>
        {copy.parts.map((part, i) =>
          typeof part === "string" ? (
            <React.Fragment key={i}>{part}</React.Fragment>
          ) : editable ? (
            <InlineValue
              key={part.key}
              value={params[part.key]}
              label={part.label}
              money={part.money}
              suffix={part.suffix}
              step={part.step}
              currency={currency}
              onCommit={(n) => onChange({ params: { [part.key]: n } })}
            />
          ) : (
            <StaticValue key={part.key} value={params[part.key]} money={part.money} suffix={part.suffix} currency={currency} />
          )
        )}
      </p>

      {(showMode || hits != null) && (
        <div className="flex flex-wrap items-center gap-2">
          {showMode && (
            <SegmentedTabs
              size="sm"
              ariaLabel={`${copy.title} mode`}
              value={rule.mode}
              items={MODE_ITEMS}
              onValueChange={(mode) => {
                if (!editable || mode === "auto" || mode === rule.mode) return
                onChange({ mode })
              }}
            />
          )}
          {hits != null && (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {hits} {hits === 1 ? "hit" : "hits"} in dry run
            </span>
          )}
        </div>
      )}
    </div>
  )
}
