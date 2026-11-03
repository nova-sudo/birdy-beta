import { currencySymbol } from "@/lib/chat-viz"

/** Test status → badge label and tone. */
export const VERDICT_META = {
  draft: { label: "Draft", tone: "neutral" },
  posting: { label: "Posting", tone: "neutral" },
  testing: { label: "Testing", tone: "info" },
  winner: { label: "Winner", tone: "success" },
  loser: { label: "Loser", tone: "danger" },
  inconclusive: { label: "Inconclusive", tone: "warning" },
  archived: { label: "Archived", tone: "muted" },
}

const SCORE_TONES = { pass: "success", fail: "danger", scoring: "warning", removed: "muted" }

/** Score state → tone. */
export function scoreTone(state) {
  return SCORE_TONES[state] ?? "muted"
}

const fin = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const money = (n, currency) => `${currencySymbol(currency)}${Math.round(n).toLocaleString("en-US")}`

/**
 * How far an ad is toward its scoring floor: whichever of spend/min_spend and
 * days_live/min_days is further along, capped at 1. The currency comes from
 * `currency` or `score.currency`.
 * @returns {{pct: number, label: string}}
 */
export function floorProgress(score, targets, currency) {
  const minSpend = fin(targets?.min_spend)
  const minDays = fin(targets?.min_days)
  const spend = fin(score?.spend)
  const days = fin(score?.days_live)
  const spendPct = minSpend > 0 ? spend / minSpend : 0
  const daysPct = minDays > 0 ? days / minDays : 0
  const pct = Math.min(1, Math.max(spendPct, daysPct))
  if (pct >= 1) return { pct: 1, label: "done" }
  if (spendPct >= daysPct) {
    const cur = currency ?? score?.currency
    return { pct, label: `${money(spend, cur)} / ${money(minSpend, cur)}` }
  }
  return { pct, label: `day ${Math.floor(days)} of ${minDays}` }
}

/** Cost per lead; "— · 0 leads" when money was spent and nothing came back. */
export function formatCpl(score, currency) {
  if (score?.cpl != null && Number.isFinite(Number(score.cpl))) {
    return `${currencySymbol(currency)}${Number(score.cpl).toFixed(2)}`
  }
  return fin(score?.spend) > 0 ? "— · 0 leads" : "—"
}

/**
 * The currency a test's totals are shown in: its summary's (the user's currency), else
 * whatever its ads report, else `fallback` (callers pass a sibling test's currency, then a default).
 */
export function testCurrency(test, fallback) {
  const ads = test?.ads ?? []
  return (
    test?.summary?.currency ??
    ads.find((a) => a?.currency)?.currency ??
    ads.find((a) => a?.score?.currency)?.score?.currency ??
    fallback
  )
}

/** One ad's currency: its own, else its test's (see testCurrency). */
export function adCurrency(ad, test, fallback) {
  return ad?.currency ?? ad?.score?.currency ?? testCurrency(test, fallback)
}
