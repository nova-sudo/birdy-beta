"use client"

import { useState } from "react"

import { Badge, Button, EmptyState, ErrorState, Frame, Notice, Skeleton, confirm } from "@/components/ds"
import { creativeName, money, useOutcomes } from "@/lib/stock-agent-api"

const RESULTS = {
  won: { tone: "success", label: "Won" },
  lost: { tone: "danger", label: "Lost" },
  no_clear_change: { tone: "neutral", label: "No clear change" },
  never_went_live: { tone: "warning", label: "Never went live" },
  undone: { tone: "neutral", label: "Undone" },
  unscored: { tone: "neutral", label: "Not scored" },
  cleared: { tone: "neutral", label: "Cleared" },
}
const WAITING = { tone: "info", label: "Waiting" }
const CLEARABLE = ["won", "lost"]
const NOT_A_MOVE = ["unscored", "cleared"]
const REPORT_ROWS = 5
const KEEPS_WORKING_AFTER = 2

/** One row per creative, counted as the server counts: a cleared or unscored result isn't a move. */
function byCreative(rows) {
  const out = new Map()
  for (const row of rows) {
    const key = row.creative_key ?? row.ad_name
    const entry = out.get(key) ?? { key, name: creativeName(row.ad_name), won: 0, moves: 0 }
    const result = String(row.result ?? "").toLowerCase()
    if (result === "won") entry.won += 1
    if (!NOT_A_MOVE.includes(result)) entry.moves += 1
    out.set(key, entry)
  }
  return [...out.values()].filter((e) => e.moves > 0).sort((a, b) => b.won - a.won || b.moves - a.moves)
}

function Suggestion({ proposal, actions }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const press = async (key, fn) => {
    setBusy(key)
    setError(null)
    try {
      await fn(proposal.id)
    } catch (err) {
      setError(err?.message || "That didn't work. Try again.")
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-control bg-primary-soft px-2.5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1">Make it a rule? {proposal.text}</p>
        <span className="flex gap-2">
          <Button size="sm" variant="primary" loading={busy === "yes"} disabled={Boolean(busy)} onClick={() => press("yes", actions.acceptProposal)}>Yes</Button>
          <Button size="sm" loading={busy === "no"} disabled={Boolean(busy)} onClick={() => press("no", actions.rejectProposal)}>No</Button>
        </span>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}

/** The report's scoreboard: how each creative has done, and the rule suggestions. Single results live in the Scoreboard tab. */
export function ScoreboardFrame({ scoreboard, proposals = [], actions, onSeeAll }) {
  const rows = scoreboard?.rows ?? []
  const creatives = byCreative(rows)
  const top = creatives[0]
  const title = top && top.won >= KEEPS_WORKING_AFTER && top.won === top.moves ? `${top.name} keeps working wherever we move it` : "Scoreboard"
  return (
    <Frame
      title={title}
      action={rows.length > 0 ? <Button size="sm" variant="ghost" onClick={onSeeAll}>See every result</Button> : undefined}
      padded
      contentClassName="flex flex-col gap-2.5 text-xs"
    >
      {rows.length === 0 && proposals.length === 0 && <p className="text-muted-foreground">No results yet. Each ad Birdy moves is scored after a few days.</p>}
      {creatives.slice(0, REPORT_ROWS).map((c) => (
        <div key={c.key} className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate">{c.name}</span>
          <span className="shrink-0 font-semibold">worked {c.won} of {c.moves}</span>
        </div>
      ))}
      {proposals.map((p) => (
        <Suggestion key={p.id} proposal={p} actions={actions} />
      ))}
    </Frame>
  )
}

function ResultRow({ row, actions, nameOf, onError }) {
  const [busy, setBusy] = useState(false)
  const result = RESULTS[String(row.result ?? "").toLowerCase()] ?? WAITING
  const clear = async () => {
    const yes = await confirm({
      title: "Clear this result?",
      description: "It stops counting for or against this ad, and stays listed as cleared. You can't undo this.",
      confirmLabel: "Clear result",
    })
    if (!yes) return
    setBusy(true)
    onError(null)
    try {
      await actions.clearOutcome(row.id)
    } catch (err) {
      onError(err?.message || "Couldn't clear that result. Try again.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3.5 py-2.5 font-medium [overflow-wrap:anywhere]">{row.ad_name}</td>
      <td className="px-3.5 py-2.5">{row.client_group_id ? nameOf(row.client_group_id) : "n/a"}</td>
      <td className="px-3.5 py-2.5"><Badge tone={result.tone} size="sm">{result.label}</Badge></td>
      <td className="num px-3.5 py-2.5 text-right">{money(row.spend, row.currency) ?? "n/a"}</td>
      <td className="num px-3.5 py-2.5 text-right">{row.leads ?? "n/a"}</td>
      <td className="num px-3.5 py-2.5 text-right">{money(row.cpl, row.currency) ?? "n/a"}</td>
      <td className="px-3.5 py-2.5 text-right">
        {CLEARABLE.includes(row.result) && (
          <Button size="sm" loading={busy} aria-label={`Clear the result for ${row.ad_name}`} onClick={clear}>Clear</Button>
        )}
      </td>
    </tr>
  )
}

/** The Scoreboard tab: every result, each in its own currency, and a way to take back a wrong one. */
export function ScoreboardTab({ agentId, actions, nameOf }) {
  const { outcomes, error, mutate } = useOutcomes(agentId)
  const [clearError, setClearError] = useState(null)
  if (!outcomes) {
    return error ? <ErrorState title="Couldn't load the scoreboard" description={error.message} onRetry={() => mutate()} /> : <Skeleton className="h-64 w-full rounded-frame" />
  }
  const rows = outcomes.rows ?? []
  if (rows.length === 0) {
    return <EmptyState variant="surface" title="No results yet" description="Each ad Birdy adds or you flag is scored here after a few days." />
  }
  return (
    <div className="flex flex-col gap-4">
      {clearError && <Notice tone="danger">{clearError}</Notice>}
      <Frame title="Every result" description={`Won ${outcomes.won ?? 0} · Lost ${outcomes.lost ?? 0} · Moves ${outcomes.moves ?? 0}`} descriptionInline>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3.5 py-2.5 font-medium">Ad</th>
                <th className="px-3.5 py-2.5 font-medium">Client</th>
                <th className="px-3.5 py-2.5 font-medium">Result</th>
                <th className="px-3.5 py-2.5 text-right font-medium">Spend</th>
                <th className="px-3.5 py-2.5 text-right font-medium">Leads</th>
                <th className="px-3.5 py-2.5 text-right font-medium">Cost per lead</th>
                <th className="px-3.5 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ResultRow key={row.id} row={row} actions={actions} nameOf={nameOf} onError={setClearError} />
              ))}
            </tbody>
          </table>
        </div>
      </Frame>
    </div>
  )
}
