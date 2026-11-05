"use client"

import { useState } from "react"

import { Button, Notice, ProgressBar, Spinner, Surface } from "@/components/ds"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { dayLabel, openLines, reportBusy, runLabel, shortDay } from "@/lib/stock-agent-api"
import { AlertsFrame, clientProblems } from "./AlertsFrame"
import { stoppedClients, worstClient } from "./cpl"
import { FollowUps } from "./FollowUps"
import { LearnedFrame } from "./LearnedFrame"
import { ReportClients } from "./ReportClients"
import { ScoreboardFrame } from "./Scoreboard"
import { WeeklyMessage } from "./WeeklyMessage"

const UNFINISHED = ["pending", "healthy", "waiting", "alerted", "needs_writing"]
const DAY_MS = 24 * 60 * 60 * 1000
const NAMES_SHOWN = 3
/** Names a few and counts the rest: a report can have dozens of clients. */
const listed = (names) => {
  const shown = names.length > NAMES_SHOWN + 1 ? [...names.slice(0, NAMES_SHOWN), `${names.length - NAMES_SHOWN} more`] : names
  return new Intl.ListFormat("en-GB", { type: "conjunction" }).format(shown)
}
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`)

/** The answer to "what do I do this morning", from the report's own numbers. */
function answer(cards, alerts, nameOf) {
  const stopped = stoppedClients(cards, alerts)
  const isStopped = (c) => stopped.has(c.client_group_id)
  const count = (fn) => cards.filter(fn).length
  const green = count((c) => c.zone === "green" && !isStopped(c))
  const yellow = count((c) => c.zone === "yellow" && !isStopped(c))
  const red = count((c) => c.zone === "red" || isStopped(c))
  const noData = cards.length - green - yellow - red
  const parts = [
    green && `${green} green`,
    yellow && `${yellow} yellow`,
    red && `${red} red or stopped`,
    noData && `${noData} no data`,
  ].filter(Boolean)
  const open = alerts.filter((a) => a.severity !== "info")
  const urgent = alerts.find((a) => a.severity === "critical")
  const worst = worstClient(cards, stopped)

  let title = parts.length ? `${parts.join(", ")}.` : open.length ? `${plural(open.length, "alert")} to look at.` : "No client has a card in this report."
  if (urgent?.client_group_id) title += ` Look at ${nameOf(urgent.client_group_id)} first.`
  else if (urgent) title += ` Start with this: ${urgent.title}.`
  else if (worst) title += ` Look at ${worst.client_name} first.`

  const waiting = cards.filter((c) => openLines(c).length > 0)
  const bits = []
  if (urgent) bits.push(sentence(urgent.detail || urgent.title))
  if (waiting.length) {
    const ask = `${plural(waiting.length, "card")} ${waiting.length === 1 ? "needs" : "need"} your OK: ${listed(waiting.map((c) => c.client_name))}.`
    bits.push(urgent ? `Then ${ask}` : ask)
  }
  return { title, body: bits.join(" ") }
}

/** The report's date, batch and window, as one line. */
function subtitle(run, cards, batches) {
  const bits = [runLabel(run, batches)]
  const w = cards.find((c) => c.window?.start && c.window?.end)?.window
  if (w) {
    const days = w.prev_start && w.prev_end ? Math.round((new Date(w.prev_end) - new Date(w.prev_start)) / DAY_MS) + 1 : null
    bits.push(`${shortDay(w.start)} to ${shortDay(w.end)}${days ? ` compared with the ${days} days before` : ""}`)
  }
  return bits.join(" · ")
}

function AnswerBox({ title, children }) {
  return (
    <Surface className="flex gap-3">
      <BirdyAvatar size={36} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-[17px] font-semibold leading-snug">{title}</h3>
        {children}
      </div>
    </Surface>
  )
}

function Progress({ run }) {
  const states = Object.values(run.clients ?? {}).map((c) => c.state)
  const done = states.filter((s) => !UNFINISHED.includes(s)).length
  const waitingOnly = states.some((s) => s === "waiting") && states.filter((s) => UNFINISHED.includes(s)).every((s) => s === "waiting")
  return (
    <AnswerBox title="Birdy is still working on this report">
      <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
        <Spinner aria-hidden className="mt-0.5 shrink-0" />
        <span>
          {`${done} of ${plural(states.length, "client")} checked.`}
          {waitingOnly && " Waiting for ad data from Meta. It carries on by itself once the data arrives."}
        </span>
      </p>
      <ProgressBar value={states.length ? (done / states.length) * 100 : 0} tone="primary" label="Report progress" />
    </AnswerBox>
  )
}

/** Whether this report reached Slack. Slack is optional, so an agent with no channel gets no warning on every report. */
function SlackNotice({ run, slackChannel }) {
  if (!slackChannel && !run.slack?.ts) return null
  if (run.publish_error) {
    return (
      <Notice tone="warning" title="This report didn't reach Slack">
        {run.publish_error}
        {run.slack_pending ? " Birdy will try again." : ""}
      </Notice>
    )
  }
  if (run.slack_pending) return <Notice tone="info">This report is being sent to Slack.</Notice>
  if (run.slack_late) return <Notice tone="neutral">Posted late: Slack couldn&apos;t take this when it was ready.</Notice>
  return null
}

function ApplyAllResult({ result, busy }) {
  if (result.error) return <Notice tone="danger">{result.error}</Notice>
  // Once those lines have finished, each says how it ended and "still going" would be out of date.
  if (result.outcome === "queued" && !busy) return null
  const bits = [
    result.applied && `Applied ${result.applied}.`,
    result.blocked && `Blocked ${result.blocked}.`,
    result.failed && `Failed ${result.failed}.`,
    result.needs_file && `Waiting for a file ${result.needs_file}.`,
    result.queued && `Still going ${result.queued}.`,
  ].filter(Boolean)
  if (bits.length === 0) {
    return result.outcome === "queued" ? <Notice tone="info">Birdy is still working through these.</Notice> : <Notice tone="neutral">Nothing was left to apply.</Notice>
  }
  return <Notice tone={result.blocked || result.failed || result.needs_file ? "warning" : result.queued ? "info" : "success"}>{bits.join(" ")}</Notice>
}

/**
 * One report, top to bottom: answer box, agency-wide alerts, the clients with their details beside them, Follow-ups,
 * Scoreboard, What I learned, Weekly message when due. `preview` is the setup step's read-only version.
 *
 * @param {object} props
 * @param {object} props.report The run view from `useRun`
 * @param {{id: string, name: string}[]} [props.clients] To name clients with no card
 * @param {{id: string, name: string}[]} [props.batches] To name the run's batch
 * @param {object} props.actions From `useStockActions`
 * @param {string} [props.slackChannel] The agent's Slack channel, if it has one
 * @param {boolean} [props.preview]
 * @param {() => void} [props.onSeeScoreboard]
 */
export function MorningReport({ report, clients = [], batches = [], actions, slackChannel, preview = false, onSeeScoreboard }) {
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState(null)

  const { run } = report
  const cards = report.cards ?? []
  const alerts = (run.alerts ?? []).filter((a) => a && typeof a === "object")
  const learned = report.learned ?? []
  const proposals = report.proposals ?? []
  const followUps = report.follow_ups ?? []

  const nameOf = (gid) => cards.find((c) => c.client_group_id === gid)?.client_name ?? clients.find((c) => c.id === gid)?.name ?? "A client"
  const inProgress = run.phase !== "done"
  const problems = clientProblems(run, nameOf)
  const summary = run.summary ?? {}
  const openAlerts = alerts.filter((a) => a.severity !== "info")
  const general = alerts.filter((a) => !a.client_group_id)
  const allClear = !inProgress && run.kind === "alert_only" && cards.length === 0 && openAlerts.length === 0 && problems.length === 0 && !summary.stale && !summary.reconnect && !run.reconnect
  const open = preview ? 0 : cards.reduce((n, c) => n + openLines(c).length, 0)
  const n = Object.keys(run.clients ?? {}).length
  const said = answer(cards, alerts, nameOf)

  const applyAll = async () => {
    setApplying(true)
    setResult(null)
    try {
      setResult(await actions.applyRun(run.id))
    } catch (err) {
      setResult({ error: err?.message || "That didn't work. Try again." })
    } finally {
      setApplying(false)
    }
  }

  const allAsk = cards.flatMap((c) => c.lines ?? []).every((ln) => ln.mode === "ask")
  const hasLines = cards.some((c) => c.lines?.length)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {!preview && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[19px] font-semibold">Morning report</h2>
            <p className="text-[13px] text-muted-foreground">{subtitle(run, cards, batches)}</p>
          </div>
          {open > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Cards are still arriving, and Apply all would take ones nobody has read. */}
              {inProgress && <span className="text-xs text-muted-foreground">Apply all opens when Birdy has finished this report.</span>}
              <Button variant="primary" loading={applying} disabled={inProgress} onClick={applyAll}>
                Apply {plural(open, "change")}
              </Button>
            </div>
          )}
        </div>
      )}

      {result && <ApplyAllResult result={result} busy={reportBusy(report)} />}
      {!preview && <SlackNotice run={run} slackChannel={slackChannel} />}
      {run.ended_early && <Notice tone="warning">This report stopped before it finished checking every client.</Notice>}
      {summary.stale && <Notice tone="warning">Some ad statuses couldn&apos;t be refreshed, so stored ones were used. Changes on those clients wait for you.</Notice>}

      {inProgress ? (
        <Progress run={run} />
      ) : allClear ? (
        <AnswerBox title={`All clear for ${dayLabel(run.local_date)}: ${plural(n, "client")} checked, nothing needs you.`} />
      ) : (
        <AnswerBox title={said.title}>{said.body && <p className="text-sm text-muted-foreground">{said.body}</p>}</AnswerBox>
      )}

      {!allClear && general.length > 0 && <AlertsFrame alerts={general} />}
      {!allClear && (
        <ReportClients
          cards={cards}
          alerts={alerts}
          problems={problems}
          nameOf={nameOf}
          actions={actions}
          preview={preview}
          disabled={applying}
          description={hasLines && allAsk ? "Ask me is on for all of these" : undefined}
        />
      )}

      {!allClear && !preview ? (
        <div className={followUps.length ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "grid grid-cols-1 gap-4"}>
          {followUps.length > 0 && <FollowUps items={followUps} nameOf={nameOf} />}
          <ScoreboardFrame scoreboard={report.scoreboard} proposals={proposals} actions={actions} onSeeAll={onSeeScoreboard} />
        </div>
      ) : (
        <>
          {followUps.length > 0 && <FollowUps items={followUps} nameOf={nameOf} />}
          {allClear && proposals.length > 0 && <ScoreboardFrame scoreboard={report.scoreboard} proposals={proposals} actions={actions} onSeeAll={onSeeScoreboard} />}
        </>
      )}

      {!preview && learned.length > 0 && <LearnedFrame lessons={learned} actions={actions} nameOf={nameOf} />}

      {!preview && <WeeklyMessage weekly={report.weekly} run={run} actions={actions} />}
    </div>
  )
}
