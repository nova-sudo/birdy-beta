"use client"

import { useMemo, useRef, useState } from "react"

import { Badge, Button, DataTable, EmptyState, ErrorState, Frame, FrameAction, Notice, Skeleton, confirm } from "@/components/ds"
import { creativeName, money, useOutcomes } from "@/lib/stock-agent-api"
import { usePress } from "./usePress"

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
  const { busy, error, press } = usePress()
  return (
    <div className="flex flex-col gap-2 rounded-control bg-primary-soft px-2.5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1">Make it a rule? {proposal.text}</p>
        <span className="flex gap-2">
          <Button size="sm" variant="primary" loading={busy === "yes"} disabled={Boolean(busy)} onClick={() => press("yes", () => actions.acceptProposal(proposal.id))}>Yes</Button>
          <Button size="sm" loading={busy === "no"} disabled={Boolean(busy)} onClick={() => press("no", () => actions.rejectProposal(proposal.id))}>No</Button>
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
      title={<span className="whitespace-normal">{title}</span>}
      action={rows.length > 0 ? <FrameAction onClick={onSeeAll}>See every result</FrameAction> : undefined}
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

function ClearResult({ row, actions, onError }) {
  const [busy, setBusy] = useState(false)
  if (!CLEARABLE.includes(row.result)) return null
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
  return <Button size="sm" loading={busy} aria-label={`Clear the result for ${row.ad_name}`} onClick={clear}>Clear</Button>
}

const Num = ({ children }) => <span className="num block text-right">{children}</span>
const number = (id, header, cell) => ({ id, header, enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <Num>{cell(row.original) ?? "n/a"}</Num> })

/** The Scoreboard tab: every result, each in its own currency, and a way to take back a wrong one. */
export function ScoreboardTab({ agentId, actions, nameOf }) {
  const { outcomes, error, mutate } = useOutcomes(agentId)
  const [clearError, setClearError] = useState(null)
  // DataTable mounts each `cell` as a component, so new columns would remount every row and lose a Clear's busy state.
  // `actions` and `nameOf` change on every page render, so cells read them from here and the columns stay put.
  const latest = useRef()
  latest.current = { actions, nameOf }
  const columns = useMemo(
    () => [
      { id: "ad", header: "Ad", enableSorting: false, cell: ({ row }) => <span className="font-medium">{row.original.ad_name}</span> },
      { id: "client", header: "Client", enableSorting: false, cell: ({ row }) => (row.original.client_group_id ? latest.current.nameOf(row.original.client_group_id) : "n/a") },
      {
        id: "result",
        header: "Result",
        enableSorting: false,
        cell: ({ row }) => {
          const result = RESULTS[String(row.original.result ?? "").toLowerCase()] ?? WAITING
          return <Badge tone={result.tone} size="sm">{result.label}</Badge>
        },
      },
      number("spend", "Spend", (r) => money(r.spend, r.currency)),
      number("leads", "Leads", (r) => r.leads),
      number("cpl", "Cost per lead", (r) => money(r.cpl, r.currency)),
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { label: "Actions", align: "right", cardHidden: (r) => !CLEARABLE.includes(r.result) },
        cell: ({ row }) => <ClearResult row={row.original} actions={latest.current.actions} onError={setClearError} />,
      },
    ],
    []
  )
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
        <DataTable columns={columns} data={rows} paginate={false} getRowId={(r) => r.id} />
      </Frame>
    </div>
  )
}
