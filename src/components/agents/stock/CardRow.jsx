"use client"

import { useRef, useState } from "react"
import { ChevronDown, Upload } from "lucide-react"

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
import { LINE_BUSY, creativeName, openLines, reasonCopy, undoOpen } from "@/lib/stock-agent-api"
import { ZONES, cplText } from "./CplBars"
import { MODE_LABELS } from "./ModesTable"
import { usePress } from "./usePress"

const VERBS = { add: "Add", remove: "Remove", revive: "Bring back" }
const STATUS = {
  applied: { tone: "success", text: "Applied" },
  partly_applied: { tone: "warning", text: "Partly applied" },
  dismissed: { tone: "neutral", text: "Dismissed" },
  flagged: { tone: "info", text: "Flag only" },
  superseded: { tone: "neutral", text: "Replaced by a newer card" },
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

const usDate = (iso) => {
  const [y, m, d] = String(iso ?? "").slice(0, 10).split("-")
  return d ? `${m}/${d}/${y.slice(2)}` : ""
}
const windowText = (w) => (w?.start && w?.end ? `${usDate(w.start)} - ${usDate(w.end)}` : "n/a")
const firstSentence = (text) => String(text ?? "").split(/(?<=\.)\s/)[0]

/** The short line beside the client's name. */
function headline(card) {
  const lines = card.lines ?? []
  if (lines.length === 0) return card.tag === "green" ? "No changes are needed" : firstSentence(card.thought_process)
  const proven = lines.find((ln) => ln.kind === "add" && ln.record?.moves > 0)
  if (proven) return `${creativeName(proven.ad_name)} (worked ${proven.record.won} of ${proven.record.moves})`
  return lines.map((ln) => creativeName(ln.ad_name)).join(", ")
}

function TagBadge({ card }) {
  if (card.tag === "changes") return <Badge tone={ZONES[card.zone]?.tone ?? "primary"} size="sm">Changes</Badge>
  if (card.tag === "green") return <Badge tone="success" size="sm">Green</Badge>
  return <Badge tone="neutral" size="sm">No changes</Badge>
}

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

/**
 * One client's card: a collapsed row with its decisions, opening to the playbook's format and each line's state.
 * A read-only (preview) card offers nothing to press. One a newer card replaced offers only Undo, where the server allows it.
 */
export function CardRow({ card, actions, readOnly = false, disabled = false }) {
  const [open, setOpen] = useState(false)
  const { busy, error, press: run } = usePress(FALLBACK)
  const [message, setMessage] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [progress, setProgress] = useState(0)

  const lines = card.lines ?? []
  const status = card.has_newer ? STATUS.superseded : STATUS[card.status]
  const replaced = card.status === "superseded" || card.has_newer
  const off = disabled || Boolean(busy)
  const canApply = !readOnly && openLines(card).length > 0
  // Only a card proposing changes has anything to edit or decline: green and no-changes cards never have lines.
  const decidable = !readOnly && !replaced && card.tag === "changes"
  const canEdit = decidable && EDITABLE.includes(card.status)
  const canDismiss = decidable && [...EDITABLE, "partly_applied"].includes(card.status)
  const canChange = !readOnly && !replaced && ACTIONABLE.includes(card.status)
  const needsYou = canChange ? lines.filter((ln) => NEEDS_A_PERSON.includes(ln.state)).length : 0
  const working = lines.some((ln) => LINE_BUSY.includes(ln.state))

  // Whatever comes back, the card opens: a line's note or error is the rest of the answer.
  const press = async (key, fn, done) => {
    setMessage(null)
    const res = await run(key, fn)
    setOpen(true)
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

  return (
    <article aria-label={card.client_name} className="border-b last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-[1_1_16rem] flex-wrap items-center gap-2.5 rounded-control text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          <span className="text-sm font-semibold">{card.client_name}</span>
          <TagBadge card={card} />
          {status && <Badge tone={status.tone} size="sm">{status.text}</Badge>}
          {needsYou > 0 && <Badge tone="danger" size="sm">{needsYou} {needsYou === 1 ? "needs" : "need"} you</Badge>}
          {working && <Badge tone="info" size="sm">Working</Badge>}
          <span className="min-w-0 text-xs text-muted-foreground">{headline(card)}</span>
        </button>
        <span className="flex gap-2">
          {canEdit && <Button size="sm" disabled={off} onClick={() => setDialog("edit")}>Edit</Button>}
          {canDismiss && <Button size="sm" disabled={off} onClick={() => setDialog("dismiss")}>Dismiss</Button>}
          {canApply && (
            <Button size="sm" variant="primary" loading={busy === "apply"} disabled={off} onClick={() => press("apply", () => actions.applyCard(card.id))}>
              Apply
            </Button>
          )}
        </span>
      </div>

      {open && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {error && <Notice tone="danger">{error}</Notice>}
          {showMessage && <Notice tone={message.tone}>{message.text}</Notice>}
          {card.press_note && <Notice tone="warning">{card.press_note}</Notice>}
          {card.stale && <Notice tone="warning">Some of this client&apos;s ad statuses couldn&apos;t be refreshed, so changes wait for you rather than running by themselves.</Notice>}
          {card.ai_failed && <Notice tone="warning">Birdy couldn&apos;t write this card, so it proposes no changes.</Notice>}
          <div className="flex flex-col gap-3 rounded-control bg-frame p-3.5 text-sm [overflow-wrap:anywhere]">
            <p>📢 ACCOUNT UPDATE - GENERAL UPDATE</p>
            <div>
              <p className="font-medium">🎯 Account Breakdown</p>
              <p>🏥 Client Name: {card.client_name}</p>
              <p>📅 Data Window: {windowText(card.window)}</p>
              <p>📜 Previous CPL: <span className="num">{cplText(card, "previous_cpl")}</span></p>
              <p>📈 Current CPL: <span className="num">{cplText(card)}</span></p>
            </div>
            <div>
              <p className="mb-1 font-medium">🎨 Creative Changes</p>
              {lines.length === 0 ? (
                <p>n/a</p>
              ) : (
                <ul>
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
            </div>
            <div>
              <p className="font-medium">⚙️ Additional Changes</p>
              <p className="whitespace-pre-wrap">{card.additional_changes || "n/a"}</p>
            </div>
            <div>
              <p className="font-medium">💭 The Thought Process</p>
              <p className="whitespace-pre-wrap">{card.thought_process || "n/a"}</p>
            </div>
            <div>
              <p className="font-medium">⏳ The Next Steps</p>
              <p className="whitespace-pre-wrap">{card.next_steps || "n/a"}</p>
            </div>
          </div>
        </div>
      )}

      {dialog === "edit" && <EditDialog card={card} actions={actions} onClose={() => setDialog(null)} />}
      {dialog === "dismiss" && <DismissDialog card={card} actions={actions} onClose={() => setDialog(null)} />}
    </article>
  )
}
