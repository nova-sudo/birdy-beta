"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { Check, ExternalLink } from "lucide-react"

import {
  BADGE_TONE_TEXT,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@/components/ds"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import ChatConversation from "@/components/chat/ChatConversation"
import { appendMessage, seedMessages, useChat } from "@/lib/chat-store"
import { uploadCreativeMedia, validateCreativeFile } from "@/lib/creative-upload"
import { money, openLines, revalidateStock, useCardChat, useStockActions } from "@/lib/stock-agent-api"
import { cn } from "@/lib/utils"
import { Line, fileFor } from "../CardPanel"
import { usePress } from "../usePress"
import { applySummary, openingMessage, quickReplies } from "./opening"

export const CARD_CHAT_PAGE = "stock_card"
const ZONE_TONE = { grn: "success", amb: "warning", red: "danger", gry: "neutral" }
/**
 * Card tool results after which the sheet must re-read: the card changed (applied, dismissed, edited), its lines
 * moved though none got through (apply_failed), a lesson was saved (the Lessons tab), or a refusal said the card
 * moved on without this chat (stale: the cron, Slack or another tab decided it).
 */
const CARD_CHANGES = ["applied", "apply_failed", "dismissed", "edited", "lesson", "stale"]
const CHANGE_CHIPS = { applied: "Changes applied", dismissed: "Card skipped", edited: "Card edited", lesson: "Lesson saved" }

/** The chips under one of Birdy's replies: what its tools did. */
export const changeChips = (message) => [...new Set((message.agent_changes ?? []).map((c) => CHANGE_CHIPS[c.changed]).filter(Boolean))]

function Figure({ label, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <b className="font-display font-semibold tabular-nums text-foreground">{children}</b>
    </span>
  )
}

/** The figures row under the client's name: Leads, CPL chip, Last week, Ad spend. */
function Figures({ row, card }) {
  const currency = card?.currency ?? row.currency
  const cpl = card?.current_cpl ?? row.cpl
  const prev = card?.previous_cpl ?? row.prev
  const leads = card?.leads ?? row.leads
  const spend = card?.spend ?? row.spend
  if (cpl == null && leads == null && spend == null) return <p className="text-sm text-muted-foreground">No figures for this report</p>
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      {leads != null && <Figure label="Leads">{Number(leads).toLocaleString("en-GB")}</Figure>}
      <span className="inline-flex items-center gap-1.5">
        <span className="text-muted-foreground">CPL</span>
        <Badge size="sm" tone={ZONE_TONE[row.zone] ?? "neutral"} className="font-display">{money(cpl, currency) ?? "No leads"}</Badge>
      </span>
      {prev != null && <Figure label={row.readOnly ? "Week before" : "Last week"}>{money(prev, currency)}</Figure>}
      {spend != null && <Figure label="Ad spend">{money(spend, currency)}</Figure>}
    </div>
  )
}

/** Birdy's first message, built from the card on the client (no AI call). */
function Opening({ message }) {
  return (
    <div className="flex flex-col gap-2" data-testid="card-opening">
      <div className="flex items-center gap-2">
        <BirdyAvatar size={30} paused />
        <span className="font-display text-sm font-bold text-foreground">Birdy</span>
      </div>
      <div className="flex flex-col gap-3 pl-[34px] text-sm leading-relaxed text-foreground">
        {message.alert && (
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{message.alert.headline}.</p>
            {message.alert.detail && <p className="text-muted-foreground">{message.alert.detail}</p>}
          </div>
        )}
        {message.pastNote && <p>{message.pastNote}</p>}
        {message.note && <p>{message.note}</p>}
        {message.lines.length > 0 && (
          <>
            <p>{message.pastNote ? "What was on the card:" : "Here's what I'd do:"}</p>
            <ol className="flex flex-col divide-y divide-divider border-y border-divider">
              {message.lines.map((ln) => (
                <li key={ln.id ?? ln.n} className="flex gap-3 py-3">
                  <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-display text-xs tabular-nums text-muted-foreground">
                    {ln.n}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="flex flex-wrap items-center gap-x-1.5">
                      <span className="sr-only">{ln.n}. </span>
                      <span className={cn("font-medium", BADGE_TONE_TEXT[ln.tone])}>{ln.verb}</span>
                      <span className="font-medium [overflow-wrap:anywhere]">{ln.ad}</span>
                      {ln.state && <Badge size="sm" tone={ln.state === "Applied" ? "success" : "neutral"}>{ln.state}</Badge>}
                    </p>
                    {ln.reason && <p className="text-muted-foreground">{ln.reason}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
        {message.effect && <p>{message.effect}</p>}
        {message.question && <p className="font-semibold">{message.question}</p>}
      </div>
    </div>
  )
}

/** The lines a "Yes to all" covered, each with its result: applied, failed with why, or waiting for a file (with the upload). */
function ApplyResults({ result, card, actions, disabled }) {
  const { busy, error, press } = usePress()
  const [progress, setProgress] = useState(0)
  // The live card wins once it has moved on (a retry, an upload), so the result reads as it is now.
  const lines = result.lines.map((snap) => {
    const live = card?.lines?.find((ln) => ln.id === snap.id)
    return live && live.state !== "proposed" ? live : snap
  })
  const upload = (line, file) =>
    press(`file-${line.id}`, async () => {
      const wanted = fileFor(line)
      if (validateCreativeFile(file) !== wanted.kind) throw new Error(wanted.wrong)
      setProgress(0)
      const media = await uploadCreativeMedia(file, { onProgress: setProgress })
      return actions.attachLineFile(result.card_id, line.id, media.blob_url)
    })
  return (
    <div className="flex flex-col gap-2 pl-[34px]">
      <ul aria-label="What happened to each change" className="rounded-control bg-frame px-3 py-2.5 text-sm">
        {lines.map((line) => (
          <Line
            key={line.id}
            line={line}
            canChange={!disabled}
            canUndo={false}
            disabled={disabled}
            busy={busy}
            progress={progress}
            onRetry={(ln) => press(`retry-${ln.id}`, () => actions.applyCard(result.card_id, [ln.id]))}
            onUndo={() => {}}
            onFile={upload}
          />
        ))}
      </ul>
      {error && <p className="text-xs text-danger-ink">{error}</p>}
    </div>
  )
}

/**
 * Birdy's chat about one client (spec §3.1): a centred dialog with the client's figures, Birdy's
 * opening built from the card, quick replies, and the shared ChatConversation on the `stock_card`
 * page. "Yes to all" applies with no AI call; any reply whose tools changed the card re-reads the sheet.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {object|null} props.card The card the chat is about; null while it loads
 * @param {object} props.row The sheet row (figures, zone, targets, readOnly)
 * @param {object[]} [props.alerts] The run's alerts
 * @param {{gid: string, name: string}|null} [props.nextClient] The next client still to decide, in sheet order
 * @param {number} [props.leftToDecide]
 * @param {object} [props.actions] From useStockActions; the dialog binds its own when not given
 * @param {() => void} props.onClose
 * @param {(next: {gid: string, name: string}) => void} [props.onNext]
 * @param {(gid: string) => void} [props.onSetTargets]
 */
export function ClientChatDialog({ agentId, card, row, alerts = [], nextClient = null, leftToDecide = 0, actions, onClose, onNext, onSetTargets }) {
  const { mutate } = useSWRConfig()
  const bound = useStockActions(agentId)
  const acts = actions ?? bound
  const cardId = card?.id ?? null
  const sessionKey = `stock_card:${cardId ?? row.gid}`
  const readOnly = Boolean(row.readOnly || card?.preview)
  const { loading } = useChat(sessionKey)
  const sendRef = useRef(null)
  const [applying, setApplying] = useState(false)

  // A reload shows the saved conversation: the latest session for this card seeds the chat once.
  const history = useCardChat(agentId, cardId, { sessionKey })
  useEffect(() => {
    if (history.messages.length) seedMessages(sessionKey, history.messages)
  }, [history.messages, sessionKey])

  // Any reply whose tools changed the card re-reads the sheet. Messages already there when the chat opened don't count.
  const seen = useRef(null)
  const onMessagesChange = useCallback(
    (messages) => {
      const from = seen.current ?? messages.length
      seen.current = messages.length
      const changed = messages.slice(from).some((m) => m.role !== "user" && (m.agent_changes ?? []).some((c) => CARD_CHANGES.includes(c.changed)))
      if (changed) revalidateStock(mutate, agentId)
    },
    [mutate, agentId]
  )

  const opening = useMemo(() => (card ? openingMessage(card, { alerts, readOnly, targets: row.targets }) : null), [card, alerts, readOnly, row.targets])
  const replies = card ? quickReplies(card, { alerts, hasTarget: Boolean(row.targets), readOnly }) : []

  const yesToAll = async (label) => {
    const ids = openLines(card).map((ln) => ln.id)
    setApplying(true)
    appendMessage(sessionKey, { role: "user", content: label })
    try {
      const res = await acts.applyCard(card.id)
      const lines = (res?.card?.lines ?? []).filter((ln) => ids.includes(ln.id))
      appendMessage(sessionKey, { role: "assistant", content: applySummary(lines, res), apply_result: { card_id: card.id, lines } })
    } catch (err) {
      appendMessage(sessionKey, { role: "assistant", content: err?.message || "That didn't work. Nothing changed, so try again." })
    } finally {
      setApplying(false)
    }
  }

  const onReply = (r) => {
    if (r.k === "yes_all") return yesToAll(r.label)
    if (r.k === "targets") return onSetTargets?.(row.gid)
    if (r.message) sendRef.current?.(r.message)
  }

  const renderAfterMessage = useCallback(
    (message) => {
      if (message.apply_result) return <ApplyResults result={message.apply_result} card={card} actions={acts} disabled={readOnly} />
      const chips = changeChips(message)
      if (!chips.length) return null
      return (
        <div className="flex flex-wrap gap-1.5 pl-[34px]">
          {chips.map((c) => (
            <Badge key={c} size="sm" tone="primary" icon={Check}>{c}</Badge>
          ))}
        </div>
      )
    },
    [card, acts, readOnly]
  )

  const busy = loading || applying
  const composerTop =
    replies.length > 0 ? (
      <div className="mb-2 flex flex-wrap gap-2" aria-label="Quick replies" role="group">
        {replies.map((r) =>
          r.href ? (
            <Button key={r.k} asChild size="sm" variant="outline" className="rounded-full">
              <a href={r.href} target="_blank" rel="noreferrer">
                {r.label}
                <ExternalLink aria-hidden />
              </a>
            </Button>
          ) : (
            <Button
              key={r.k}
              size="sm"
              variant={r.k === "yes_all" ? "primary" : "outline"}
              className="rounded-full"
              disabled={busy}
              loading={r.k === "yes_all" && applying}
              onClick={() => onReply(r)}
            >
              {r.label}
            </Button>
          )
        )}
      </div>
    ) : null

  // Focus goes back to the client's row in the sheet, not to wherever it was before.
  const returnFocus = (e) => {
    const target = [...document.querySelectorAll(`[data-cell="client"][data-gid="${CSS.escape(row.gid)}"]`)].find((el) => el.offsetParent !== null)
    if (target) {
      e.preventDefault()
      target.focus()
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="2xl" className="h-[85vh] w-[960px]" onCloseAutoFocus={returnFocus}>
        <DialogHeader className="gap-1.5 pb-3">
          <DialogTitle className="font-display text-[22px] leading-7">{row.name}</DialogTitle>
          <DialogDescription className="sr-only">Birdy&apos;s chat about this client</DialogDescription>
          <Figures row={row} card={card} />
        </DialogHeader>
        <DialogBody className="flex min-h-0 flex-1 flex-col p-0">
          {card ? (
            <ChatConversation
              key={sessionKey}
              sessionKey={sessionKey}
              page={CARD_CHAT_PAGE}
              agentId={agentId}
              cardId={cardId}
              cardReadOnly={readOnly}
              clientGroupId={row.gid}
              clientName={row.name}
              showScopePicker={false}
              showQuickActions={false}
              showSlowNotice={false}
              composerAutoFocus
              composerPlaceholder={readOnly ? "Ask about this report…" : "Tell Birdy what to do…"}
              intro={<Opening message={opening} />}
              composerTop={composerTop}
              renderAfterMessage={renderAfterMessage}
              onMessagesChange={onMessagesChange}
              sendRef={sendRef}
            />
          ) : (
            <div className="flex flex-col gap-3 p-6">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
        </DialogBody>
        <DialogFooter className="justify-between text-sm">
          {readOnly ? (
            <span className="text-muted-foreground">Read-only · nothing here changes anything</span>
          ) : (
            <span className="tabular-nums text-muted-foreground">{leftToDecide > 0 ? `${leftToDecide} left to decide` : "Nothing left to decide"}</span>
          )}
          {!readOnly && nextClient && (
            <Button variant="ghost" size="sm" onClick={() => onNext?.(nextClient)}>
              Skip for now: {nextClient.name} ›
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
