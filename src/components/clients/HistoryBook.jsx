"use client"

// components/clients/HistoryBook.jsx
// The Client Detail overview's history book — one timeline of what happened to
// this client, with a composer pinned to the bottom.
//
// Two sources, deliberately mixed: activity Birdy or a cron generated, and
// notes a person wrote. The whole point of the card is that the second kind
// exists — the data can say spend fell, only a person can say the client paused
// for a refit.

import { useState } from "react"
import { Send, Loader2, Trash2, StickyNote } from "lucide-react"
import { toast } from "sonner"
import { Badge, Button, Frame, Input, Skeleton } from "@/components/ds"
import { ActivityItem } from "@/components/activity/ActivityItem"
import { cn } from "@/lib/utils"

function relativeTime(iso) {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ""
  const seconds = Math.round((Date.now() - then.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return then.toLocaleDateString()
}

function NoteEntry({ note, onDelete, deleting }) {
  return (
    <div className="group flex items-start gap-3 rounded-control bg-muted p-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <StickyNote className="size-3.5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge tone="primary">Note</Badge>
          <span className="truncate text-xs text-muted-foreground">
            {note.author} · {relativeTime(note.created_at)}
          </span>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-snug text-foreground">
          {note.body}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onDelete(note.id)}
        disabled={deleting}
        aria-label={`Delete note by ${note.author}`}
        className={cn(
          "shrink-0 text-danger-ink hover:bg-danger-soft",
          // Revealed on hover or focus; always there for touch.
          "sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        )}
      >
        {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </div>
  )
}

export function HistoryBook({
  clientName,
  notes = [],
  activity = [],
  loading = false,
  onAddNote,
  onDeleteNote,
  className,
}) {
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    const ok = await onAddNote?.(body)
    setSending(false)
    if (ok) setDraft("")
    else toast.error("Could not save that note")
  }

  const remove = async (id) => {
    setDeletingId(id)
    const ok = await onDeleteNote?.(id)
    setDeletingId(null)
    if (!ok) toast.error("Could not delete that note")
  }

  // Notes first, then generated activity. They carry different time fields —
  // activity's is already a display string — so they are grouped rather than
  // interleaved on a timestamp that isn't comparable.
  const isEmpty = notes.length === 0 && activity.length === 0

  return (
    <Frame title="History book" className={className} contentClassName="flex flex-col">
      <div className="flex max-h-80 min-h-32 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))
        ) : isEmpty ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing recorded for this client yet. Add the first note below.
          </p>
        ) : (
          <>
            {notes.map((note) => (
              <NoteEntry
                key={note.id}
                note={note}
                onDelete={remove}
                deleting={deletingId === note.id}
              />
            ))}
            {activity.length > 0 && (
              <div className="flex flex-col gap-4 pt-1">
                {notes.length > 0 && (
                  <p className="text-xs font-medium text-muted-foreground">Activity</p>
                )}
                {activity.map((a) => (
                  <ActivityItem key={a.id} {...a} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-divider p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Add a note about ${clientName || "this client"}…`}
          aria-label="Add a note"
          maxLength={2000}
          disabled={sending}
          className="flex-1"
        />
        <Button
          type="submit"
          variant="primary"
          size="icon"
          disabled={!draft.trim() || sending}
          aria-label="Save note"
          className="shrink-0"
        >
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </Frame>
  )
}
