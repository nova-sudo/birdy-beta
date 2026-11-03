"use client"

import { useState } from "react"

import { Badge, Button, Frame, Notice, Surface } from "@/components/ds"
import { addCreativeAccounts, postCreativeTest, useCreativeAdAccounts, useCreativeAdsets } from "@/lib/creatives-api"
import { PostProgress } from "./PostProgress"

const MODE_LABEL = { thresholds: "Targets per metric", baseline: "Beat the account", cpl_only: "CPL only" }
const METRIC_LABEL = { cpl: "CPL", ctr: "CTR", cpc: "CPC", hook_rate: "hook rate", leads: "leads" }
const OP = { lte: "≤", gte: "≥" }

/** The body of a Post call: what the backend reads from each chosen account. */
function postBody(rows) {
  return rows.map((r) => {
    const out = {}
    for (const k of ["ad_account_id", "client_group_id", "adset_id", "adset_name", "page_id", "lead_form_id", "targets_override"]) {
      if (r[k] != null && r[k] !== "") out[k] = r[k]
    }
    return out
  })
}

function targetsSummary(t) {
  if (!t?.mode) return "No targets set"
  const metrics = Object.entries(t.metrics ?? {})
    .map(([k, m]) => (m?.value != null ? `${METRIC_LABEL[k] ?? k} ${OP[m.op] ?? ""} ${m.value}` : null))
    .filter(Boolean)
  if (t.mode === "baseline") return `Beat the account by ${t.baseline_pct}%${t.metrics?.ctr ? " (CPL and CTR)" : ""}`
  return `${MODE_LABEL[t.mode]}: ${metrics.join(" · ") || "none"}`
}

function accountLabel(account, row) {
  const names = (account?.clients ?? []).map((c) => c.name).filter(Boolean)
  return names.length ? names.join(", ") : account?.name || row.ad_account_id
}

function ReviewRow({ row, account, destination }) {
  const { adsets } = useCreativeAdsets(row.ad_account_id, destination)
  const adset = adsets.find((a) => a.id === row.adset_id)
  const paused = adset && (adset.status === "PAUSED" || adset.effective_status === "PAUSED")
  const label = accountLabel(account, row)
  const warnings = []
  if (destination === "lead_form" && !row.lead_form_id) warnings.push(`${label} has no lead form chosen.`)
  if (paused) warnings.push(`Ad set ${row.adset_name ?? adset.name} is paused in ${label}. The ad won't deliver until you turn it on.`)
  return (
    <Surface className="flex flex-col gap-1 p-3">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
        {row.targets_override?.cpl != null && <Badge tone="info">CPL ≤ {row.targets_override.cpl}</Badge>}
        <Badge tone="neutral">{account?.currency ?? "—"}</Badge>
      </div>
      <span className="text-xs text-muted-foreground">Ad set: {row.adset_name ?? row.adset_id}</span>
      {warnings.map((w) => (
        <p key={w} className="text-xs text-warning-ink">
          {w}
        </p>
      ))}
    </Surface>
  )
}

/**
 * Wizard step 4: a summary, warnings, and the Post click, the only thing that writes to Meta.
 * After it, the step becomes the live progress view.
 *
 * @param {object} props
 * @param {object} props.draft
 * @param {object[]} [props.rows] Accounts to post; defaults to the draft's
 * @param {boolean} [props.addMode] Adding accounts to a test that is already posted
 * @param {() => void} [props.onPosted] Called once the Post (or Add) call is accepted
 */
export function StepReview({ draft, rows, addMode = false, onPosted }) {
  const { accounts } = useCreativeAdAccounts()
  const [posting, setPosting] = useState(false)
  const [posted, setPosted] = useState(false)
  const [error, setError] = useState(null)
  const list = rows ?? draft.creative?.accounts ?? []
  const c = draft.creative ?? {}
  const alreadyPosted = !addMode && draft.status && draft.status !== "draft"

  if (posted || alreadyPosted) return <PostProgress testId={draft.id} />

  const global = []
  if (c.format === "image" && draft.targets?.metrics?.hook_rate) global.push("Hook rate is selected, but this is an image, so it will be skipped in scoring.")
  const n = list.length
  const noun = n === 1 ? "account" : "accounts"

  async function post() {
    setPosting(true)
    setError(null)
    try {
      await (addMode ? addCreativeAccounts : postCreativeTest)(draft.id, postBody(list))
      setPosted(true)
      onPosted?.()
    } catch (e) {
      setError(e)
    } finally {
      setPosting(false)
    }
  }

  return (
    <Frame title="Review & post" description="Ads are created paused in every account, then go live together." padded>
      <div className="flex flex-col gap-4">
        {error && <Notice tone="danger">{error.message}</Notice>}
        {global.map((w) => (
          <Notice key={w} tone="warning">
            {w}
          </Notice>
        ))}
        <div className="flex flex-col gap-2">
          {list.map((r) => (
            <ReviewRow key={r.ad_account_id} row={r} account={accounts.find((a) => a.ad_account_id === r.ad_account_id)} destination={c.destination} />
          ))}
        </div>
        {!addMode && <p className="text-sm text-muted-foreground">{targetsSummary(draft.targets)}</p>}
        <div className="flex justify-end">
          <Button disabled={posting || n === 0} loading={posting} onClick={post}>
            {addMode ? `Add ${n} ${noun}` : `Post to ${n} ${noun}`}
          </Button>
        </div>
      </div>
    </Frame>
  )
}
