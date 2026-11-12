"use client"

import { Button, Frame, FrameAction, Notice } from "@/components/ds"
import { creativeName } from "@/lib/stock-agent-api"
import { usePress } from "./usePress"

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

/** The report's scoreboard: how each creative has done, and the rule suggestions. */
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
