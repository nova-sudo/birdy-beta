"use client"

import { useMemo, useState } from "react"
import { useSWRConfig } from "swr"
import { Play, Zap } from "lucide-react"

import { Badge, Button, Frame, Notice, Skeleton, Spinner } from "@/components/ds"
import { ClaimConflicts } from "@/components/agents/ClaimConflicts"
import { HistoryProgress } from "@/components/agents/HistoryProgress"
import { MODE_LABELS } from "./ModesTable"
import { SetupFooter } from "./SetupShared"
import { activateAgent, historySettled, useAgentHistory } from "@/lib/agents-api"
import { currencySymbol } from "@/lib/chat-viz"
import { revalidateStock, usePreviewRun, useRun } from "@/lib/stock-agent-api"

const TAGS = {
  changes: { tone: "primary", text: "Changes proposed" },
  green: { tone: "success", text: "In the green" },
  no_changes: { tone: "neutral", text: "No changes" },
}
const KIND_LABELS = { remove: "Remove", add: "Add", revive: "Revive" }

const money = (n, currency) => (n == null ? "none" : `${currencySymbol(currency) ?? ""}${Number(n).toFixed(2)}`)

/** Whether a preview run finished and looked at every client now watched. */
export function previewFinished(run, ids) {
  return Boolean(run) && run.phase === "done" && !run.ended_early && ids.every((g) => g in (run.clients ?? {}))
}

function PreviewReport({ agentId, runId, clients }) {
  const { report, error, isLoading } = useRun(agentId, runId)
  const nameOf = (gid) => clients.find((c) => c.id === gid)?.name ?? "A client"
  if (isLoading) return <Skeleton className="h-40 w-full rounded-frame" />
  if (error || !report) return <Notice tone="warning">Couldn&apos;t load the preview report. Try running it again.</Notice>
  const unchecked = Object.entries(report.run?.clients ?? {}).filter(([, c]) => c.state === "failed")
  return (
    <Frame title="Your first report" description="Built from your real data. Nothing was changed in Meta or posted to Slack." padded contentClassName="flex flex-col gap-4">
      {report.cards.length === 0 && unchecked.length === 0 && <p className="text-sm text-muted-foreground">No client needed a card.</p>}
      {report.cards.map((card) => {
        const tag = TAGS[card.tag] ?? TAGS.no_changes
        return (
          <article key={card.id} aria-label={`Preview for ${card.client_name}`} className="flex flex-col gap-2 border-b pb-4 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">{card.client_name}</h3>
              <Badge tone={tag.tone} size="sm">{tag.text}</Badge>
              <span className="text-xs text-muted-foreground tabular-nums">
                Cost per lead {money(card.previous_cpl, card.currency)} to {money(card.current_cpl, card.currency)}
              </span>
            </div>
            {card.lines?.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {card.lines.map((ln) => (
                  <li key={ln.id}>
                    <span className="font-medium">{KIND_LABELS[ln.kind] ?? ln.kind}</span> {ln.ad_name}{" "}
                    <span className="text-muted-foreground">({MODE_LABELS[ln.mode] ?? ln.mode})</span>
                  </li>
                ))}
              </ul>
            )}
            {card.thought_process && <p className="text-sm text-ink-secondary">{card.thought_process}</p>}
          </article>
        )
      })}
      {unchecked.map(([gid, c]) => (
        <p key={gid} className="text-sm text-warning-ink">
          {nameOf(gid)} couldn&apos;t be checked{c.error ? `: ${c.error}` : "."}
        </p>
      ))}
    </Frame>
  )
}

/**
 * Step 6: the first report on real data, written to nothing, then Turn on. Turn on waits for a preview that
 * finished and covered every watched client.
 */
export function SetupPreview({ agent, clients, actions, flagOnly, setFlagOnly, onBack, onActivated }) {
  const { mutate } = useSWRConfig()
  const ids = useMemo(() => agent.scope?.client_group_ids ?? [], [agent.scope])
  const { history } = useAgentHistory(agent.id)
  const { run } = usePreviewRun(agent.id)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(null)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState(null)
  const [missing, setMissing] = useState([])
  const [conflicts, setConflicts] = useState(null)

  const nameOf = (gid) => clients.find((c) => c.id === gid)?.name ?? "A client"
  const running = Boolean(run) && run.phase !== "done" && !run.ended_early
  const finished = previewFinished(run, ids)
  const stale = Boolean(run) && run.phase === "done" && !finished
  const waitingOnHistory = history ? !historySettled(history) : false

  const runPreview = async () => {
    setStarting(true)
    setStartError(null)
    try {
      await actions.startPreview()
    } catch (err) {
      setStartError(
        err?.not_ready?.length
          ? `Ad history isn't ready yet for ${err.not_ready.map(nameOf).join(", ")}. Wait for it to finish, then run the preview.`
          : err?.message || "Couldn't start the preview. Try again in a moment."
      )
    }
    setStarting(false)
  }

  // `claims` is {move_claims, only_flag} when answering a conflict.
  const turnOn = async (claims = {}) => {
    setActivating(true)
    setActivateError(null)
    setMissing([])
    setConflicts(null)
    try {
      const activated = await activateAgent(agent.id, { only_flag: claims.only_flag ?? flagOnly, ...(claims.move_claims ? { move_claims: true } : {}) })
      await revalidateStock(mutate, agent.id)
      await onActivated(activated)
    } catch (err) {
      if (err?.status === 409 && err.conflicts?.length) setConflicts(err.conflicts)
      else if (err?.status === 409 && err.missing?.length) {
        setMissing(err.missing)
        setActivateError("It isn't ready to turn on yet. Still needed:")
      } else setActivateError(err?.message || "Couldn't turn it on. Try again in a moment.")
      setActivating(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <HistoryProgress history={history} />

      <Frame title="Preview your first report" description="Runs on your real data with Birdy writing the cards. It changes nothing in Meta and posts nothing to Slack." padded contentClassName="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={finished ? "outline" : "primary"} loading={starting} disabled={running || waitingOnHistory} onClick={runPreview}>
            <Play aria-hidden />
            {finished || stale ? "Run the preview again" : "Run the preview"}
          </Button>
          {waitingOnHistory && <span className="text-sm text-muted-foreground">Waiting for your ad history.</span>}
          {running && (
            <span role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner aria-hidden /> Birdy is checking your clients. This can take a few minutes.
            </span>
          )}
        </div>
        {startError && <Notice tone="warning">{startError}</Notice>}
        {stale && <Notice tone="warning">The last preview didn&apos;t finish or didn&apos;t cover every client you watch now. Run it again.</Notice>}
      </Frame>

      {finished && <PreviewReport agentId={agent.id} runId={run.id} clients={clients} />}

      {activateError && (
        <Notice tone="warning">
          <p>{activateError}</p>
          {missing.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      {conflicts && (
        <ClaimConflicts
          conflicts={conflicts}
          clients={clients}
          busy={activating}
          onMove={() => turnOn({ move_claims: true })}
          onOnlyFlag={(gid) => {
            const all = flagOnly.includes(gid) ? flagOnly : [...flagOnly, gid]
            setFlagOnly(all)
            turnOn({ only_flag: all })
          }}
        />
      )}
      <SetupFooter onBack={onBack}>
        <div className="flex flex-col items-end gap-1">
          <Button variant="primary" size="lg" loading={activating} disabled={!finished} onClick={() => turnOn()}>
            <Zap aria-hidden />
            Turn on
          </Button>
          {!finished && <span className="text-xs text-muted-foreground">Turn on after the preview has finished.</span>}
        </div>
      </SetupFooter>
    </div>
  )
}
