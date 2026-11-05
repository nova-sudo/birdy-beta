"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"

import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Notice,
  ProgressBar,
  Textarea,
} from "@/components/ds"
import { cn } from "@/lib/utils"
import { IMAGE_ACCEPT, VIDEO_ACCEPT, uploadCreativeMedia, validateCreativeFile } from "@/lib/creative-upload"
import { LINE_BUSY, openLines, reasonCopy, shortDay, undoOpen } from "@/lib/stock-agent-api"
import { count, cplText } from "./cpl"
import { MODE_LABELS } from "./ModesTable"
import { usePress } from "./usePress"

const VERBS = { add: "Add", remove: "Remove", revive: "Bring back" }
const STATUS = {
  applied: { tone: "success", text: "Applied" },
  partly_applied: { tone: "warning", text: "Partly applied" },
  dismissed: { tone: "neutral", text: "Dismissed" },
  flagged: { tone: "info", text: "Flag only" },
  superseded: { tone: "neutral", text: "Replaced by a newer card", short: "Replaced" },
}
const LINE_STATES = {
  queued: { tone: "info", text: "Queued" },
  applying: { tone: "info", text: "Applying" },
  applied: { tone: "success", text: "Applied" },
  failed: { tone: "danger", text: "Failed" },
  blocked: { tone: "warning", text: "Blocked" },
  needs_file: { tone: "warning", text: "Needs a file" },
  undoing: { tone: "info", text: "Undoing" },
  undone: { tone: "neutral", text: "Undone" },
}
const ACTIONABLE = ["open", "partly_applied"]
const EDITABLE = ["open", "flagged"]
const DROPPABLE = ["proposed", "flagged", "needs_file"]
const NEEDS_A_PERSON = ["failed", "blocked", "needs_file"]
const OUTCOME_WORDS = {
  noop: "Nothing here was waiting to be applied.",
  already: "This has already been done.",
}
const FALLBACK = "That didn't work. Try again."

/** A card's status, once it has one worth showing over its count of changes. */
export const cardStatus = (card) => (card.has_newer ? STATUS.superseded : STATUS[card.status])

const isReplaced = (card) => card.status === "superseded" || card.has_newer
const canChangeLines = (card, readOnly) => !readOnly && !isReplaced(card) && ACTIONABLE.includes(card.status)

/** How many of a card's lines are stuck until someone acts. */
export const linesNeedingYou = (card, readOnly = false) =>
  canChangeLines(card, readOnly) ? (card.lines ?? []).filter((ln) => NEEDS_A_PERSON.includes(ln.state)).length : 0

export const cardWorking = (card) => (card.lines ?? []).some((ln) => LINE_BUSY.includes(ln.state))

/** The file an Add needs, by the backend's own rule (`add._is_video`): a video when the source has a video id, else an image. */
function fileFor(line) {
  return line.creative?.video_id
    ? { kind: "video", word: "Video", label: "Upload video", accept: VIDEO_ACCEPT, wrong: "This ad needs a video, not an image." }
    : { kind: "image", word: "Image", label: "Upload image", accept: IMAGE_ACCEPT, wrong: "This ad needs an image, not a video." }
}

/** Where an ad Birdy made but left off can be found. Null for a line with no such ad. Adds what the server's words leave out. */
function pausedNote(line) {
  if (line.paused_ad_id) return `This ad exists and is paused in Meta. Find it in Ads Manager: search for ad ID ${line.paused_ad_id}.`
  const saysPaused = line.reason_code === "left_paused" || (line.kind === "add" && /paused in Meta/.test(line.error ?? ""))
  if (!saysPaused) return null
  const id = line.meta_ids?.[0]
  return id
    ? `To find it, search for ad ID ${id} in this client's Ads Manager.`
    : `To find it, search for "${line.new_ad_name ?? line.ad_name}" in this client's Ads Manager.`
}

/**
 * What a line's state means, in plain words. Null when its state says enough. An Add's message is written for the
 * moment it stopped (whether its ad exists, which file Meta wouldn't take), so fixed copy never replaces it.
 */
function lineReason(line) {
  if (line.kind === "add" && line.error) return line.error
  if (line.state === "failed") return line.error || reasonCopy(line.reason_code)
  if (line.state === "blocked") return reasonCopy(line.reason_code, line.error)
  if (line.state === "needs_file") return reasonCopy(line.reason_code || "needs_file", line.error)
  if (line.state === "flagged" && !line.note) return reasonCopy("flag_only")
  return line.error || null
}

function Line({ line, canChange, canUndo, disabled, onRetry, onUndo, onFile, busy, progress }) {
  const input = useRef(null)
  const state = LINE_STATES[line.state]
  const reason = lineReason(line)
  const paused = pausedNote(line)
  const actionable = canChange && line.mode !== "flag"
  const file = fileFor(line)
  const off = disabled || Boolean(busy)

  return (
    <li className="flex flex-col gap-1.5 border-t py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="[overflow-wrap:anywhere]">{VERBS[line.kind] ?? line.kind} - {line.ad_name}</span>
          {state ? <Badge tone={state.tone} size="sm">{state.text}</Badge> : <Badge tone="neutral" size="sm">{MODE_LABELS[line.mode] ?? line.mode}</Badge>}
          {line.record?.moves > 0 && <span className="text-xs text-muted-foreground">worked {line.record.won} of {line.record.moves}</span>}
        </span>
        <span className="flex gap-2">
          {canUndo && undoOpen(line) && <Button size="sm" loading={busy === `undo-${line.id}`} disabled={off} onClick={() => onUndo(line)}>Undo</Button>}
          {actionable && ["failed", "blocked"].includes(line.state) && (
            <Button size="sm" loading={busy === `retry-${line.id}`} disabled={off} onClick={() => onRetry(line)}>Retry</Button>
          )}
          {actionable && line.state === "needs_file" && (
            <>
              <input
                ref={input}
                type="file"
                accept={file.accept}
                aria-label={`File for ${line.ad_name}`}
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) onFile(line, file)
                }}
              />
              <Button size="sm" loading={busy === `file-${line.id}`} disabled={off} onClick={() => input.current?.click()}>
                <Upload aria-hidden />
                {file.label}
              </Button>
            </>
          )}
        </span>
      </div>
      {busy === `file-${line.id}` && <ProgressBar value={progress} tone="primary" label="Upload progress" />}
      {line.source && <p className="text-xs text-muted-foreground">From {line.source}</p>}
      {reason && <p className={cn("text-xs", line.state === "failed" ? "text-danger-ink" : line.state === "flagged" ? "text-muted-foreground" : "text-warning-ink")}>{reason}</p>}
      {line.note && <p className="text-xs text-muted-foreground">{line.note}</p>}
      {paused && <p className="text-xs text-warning-ink">{paused}</p>}
      {line.undo_error && <p className="text-xs text-danger-ink">{line.undo_error}</p>}
      {(line.flags ?? []).filter((f) => f.note).map((f) => (
        <p key={f.note} className="text-xs text-warning-ink">{f.note}</p>
      ))}
    </li>
  )
}

function EditDialog({ card, actions, onClose }) {
  const [lines, setLines] = useState(card.lines ?? [])
  const [fields, setFields] = useState({
    additional_changes: card.additional_changes ?? "",
    thought_process: card.thought_process ?? "",
    next_steps: card.next_steps ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    const patch = {}
    for (const [key, value] of Object.entries(fields)) if (value !== (card[key] ?? "")) patch[key] = value
    if (lines.length !== (card.lines ?? []).length) patch.lines = lines.map((ln) => ({ id: ln.id }))
    if (Object.keys(patch).length === 0) return onClose()
    setSaving(true)
    setError(null)
    try {
      await actions.editCard(card.id, patch)
      onClose()
    } catch (err) {
      setError(err?.message || FALLBACK)
      setSaving(false)
    }
  }
  const field = (key, label) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${card.id}-${key}`}>{label}</Label>
      <Textarea id={`${card.id}-${key}`} value={fields[key]} onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))} />
    </div>
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit {card.client_name}</DialogTitle>
          <DialogDescription>Birdy learns from what you change here.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && <Notice tone="danger">{error}</Notice>}
          {lines.length > 0 && (
            <ul className="flex flex-col gap-2 text-sm">
              {lines.map((ln) => (
                <li key={ln.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{VERBS[ln.kind] ?? ln.kind} - {ln.ad_name}</span>
                  {DROPPABLE.includes(ln.state) && (
                    <Button size="sm" aria-label={`Take off ${ln.ad_name}`} onClick={() => setLines((all) => all.filter((x) => x.id !== ln.id))}>Take off</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {field("additional_changes", "Additional changes")}
          {field("thought_process", "The thought process")}
          {field("next_steps", "The next steps")}
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DismissDialog({ card, actions, onClose }) {
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const dismiss = async () => {
    setSaving(true)
    setError(null)
    try {
      await actions.dismissCard(card.id, reason.trim() || undefined)
      onClose()
    } catch (err) {
      setError(err?.message || FALLBACK)
      setSaving(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Dismiss {card.client_name}?</DialogTitle>
          <DialogDescription>Nothing more on this card will change in Meta. Lines already applied stay applied.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${card.id}-dismiss`}>Why? Optional, and Birdy learns from it</Label>
            <Textarea id={`${card.id}-dismiss`} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={dismiss}>Dismiss card</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
      {children}
    </section>
  )
}

function Stat({ label, children }) {
  return (
    <div className="min-w-0 rounded-control bg-frame px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="num truncate text-sm font-semibold">{children}</div>
    </div>
  )
}

const Prose = ({ children }) => <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{children}</p>

/**
 * One client's card in the report's side panel: its numbers, then what Birdy would change and why.
 * `problems` sits between the two, as what's wrong comes before what to do about it.
 * A read-only (preview) card offers nothing to press. One a newer card replaced offers only Undo, where the server allows it.
 */
export function CardPanel({ card, actions, readOnly = false, disabled = false, problems = null }) {
  const { busy, error, press: run } = usePress(FALLBACK)
  const [message, setMessage] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [progress, setProgress] = useState(0)

  const lines = card.lines ?? []
  const replaced = isReplaced(card)
  const off = disabled || Boolean(busy)
  const canApply = !readOnly && openLines(card).length > 0
  // Only a card proposing changes has anything to edit or decline: green and no-changes cards never have lines.
  const decidable = !readOnly && !replaced && card.tag === "changes"
  const canEdit = decidable && EDITABLE.includes(card.status)
  const canDismiss = decidable && [...EDITABLE, "partly_applied"].includes(card.status)
  const canChange = canChangeLines(card, readOnly)

  // A line's note or error is the rest of the answer, so the words here only add what it doesn't say.
  const press = async (key, fn, done) => {
    setMessage(null)
    const res = await run(key, fn)
    if (res?.reason) setMessage({ tone: res.ok === false ? "warning" : "info", text: res.reason })
    else if (OUTCOME_WORDS[res?.outcome]) setMessage({ tone: "info", text: OUTCOME_WORDS[res.outcome] })
    else if (res && done) setMessage({ tone: "success", text: done(res) })
  }
  const upload = (line, file) => {
    const wanted = fileFor(line)
    return press(
      `file-${line.id}`,
      async () => {
        // The backend keeps whatever it's given as this creative's file, so the wrong kind stops here.
        if (validateCreativeFile(file) !== wanted.kind) throw new Error(wanted.wrong)
        setProgress(0)
        const media = await uploadCreativeMedia(file, { onProgress: setProgress })
        return actions.attachLineFile(card.id, line.id, media.blob_url)
      },
      (res) => (res.card?.can_apply ? `${wanted.word} kept. Press Apply to post this ad.` : `${wanted.word} kept.`)
    )
  }
  // A line already showing the same words doesn't need them twice.
  const showMessage = message && !lines.some((ln) => ln.error === message.text || ln.note === message.text)
  const w = card.window
  const status = cardStatus(card)
  const needsYou = linesNeedingYou(card, readOnly)
  const hasState = Boolean(status) || needsYou > 0 || cardWorking(card)

  return (
    <div className="flex flex-col gap-4">
      {(hasState || canEdit || canDismiss || canApply) && (
        <div className="flex flex-wrap items-center gap-2">
          {status && <Badge tone={status.tone} size="sm">{status.text}</Badge>}
          {needsYou > 0 && <Badge tone="danger" size="sm">{needsYou} {needsYou === 1 ? "needs" : "need"} you</Badge>}
          {cardWorking(card) && <Badge tone="info" size="sm">Working</Badge>}
          <span className="ml-auto flex flex-wrap gap-2">
          {canEdit && <Button size="sm" disabled={off} onClick={() => setDialog("edit")}>Edit</Button>}
          {canDismiss && <Button size="sm" disabled={off} onClick={() => setDialog("dismiss")}>Dismiss</Button>}
          {canApply && (
            <Button size="sm" variant="primary" loading={busy === "apply"} disabled={off} onClick={() => press("apply", () => actions.applyCard(card.id))}>
              Apply
            </Button>
          )}
          </span>
        </div>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      {showMessage && <Notice tone={message.tone}>{message.text}</Notice>}
      {card.press_note && <Notice tone="warning">{card.press_note}</Notice>}
      {card.stale && <Notice tone="warning">Some of this client&apos;s ad statuses couldn&apos;t be refreshed, so changes wait for you rather than running by themselves.</Notice>}
      {card.ai_failed && <Notice tone="warning">Birdy couldn&apos;t write this card, so it proposes no changes.</Notice>}

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Last week">{cplText(card, "previous_cpl")}</Stat>
        <Stat label="This week">{cplText(card)}</Stat>
        <Stat label="Leads">{count(card.leads)}</Stat>
        <Stat label="Ads live">{count(card.ads_live)}</Stat>
      </div>

      {problems}

      <Section title={canApply || readOnly ? "What Birdy would change" : "Changes"}>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes suggested.</p>
        ) : (
          <ul className="text-sm">
            {lines.map((line) => (
              <Line
                key={line.id}
                line={line}
                canChange={canChange}
                canUndo={!readOnly}
                disabled={disabled}
                busy={busy}
                progress={progress}
                onRetry={(ln) => press(`retry-${ln.id}`, () => actions.applyCard(card.id, [ln.id]))}
                onUndo={(ln) => press(`undo-${ln.id}`, () => actions.undoCardLine(card.id, ln.id))}
                onFile={upload}
              />
            ))}
          </ul>
        )}
      </Section>
      {card.additional_changes && <Section title="Also worth doing"><Prose>{card.additional_changes}</Prose></Section>}
      {card.thought_process && <Section title="Why"><Prose>{card.thought_process}</Prose></Section>}
      {card.next_steps && <Section title="Next"><Prose>{card.next_steps}</Prose></Section>}
      {w?.start && w?.end && <p className="text-xs text-muted-foreground">Data from {shortDay(w.start)} to {shortDay(w.end)}</p>}

      {dialog === "edit" && <EditDialog card={card} actions={actions} onClose={() => setDialog(null)} />}
      {dialog === "dismiss" && <DismissDialog card={card} actions={actions} onClose={() => setDialog(null)} />}
    </div>
  )
}
