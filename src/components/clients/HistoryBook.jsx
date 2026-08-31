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
import { Book, Send, Loader2, Trash2, StickyNote } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ActivityItem } from "@/components/activity/ActivityItem"

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
    <div className="group flex items-start gap-3 rounded-[10px] border border-pd-border p-[13px]">
      <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[#F1EEFC] text-[#6B4EE6]">
        <StickyNote className="size-3.5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-[5px] bg-[#F1EEFC] px-[7px] py-[2px] text-[10px] font-bold text-[#6B4EE6]">
            Note
          </span>
          <span className="truncate text-[10.5px] text-muted-foreground">
            {note.author} · {relativeTime(note.created_at)}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-snug whitespace-pre-wrap text-foreground">
          {note.body}
        </p>
      </div>

      <button
        onClick={() => onDelete(note.id)}
        disabled={deleting}
        aria-label={`Delete note by ${note.author}`}
        className="shrink-0 rounded p-1 text-destructive opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 disabled:opacity-50"
      >
        {deleting
          ? <Loader2 className="size-3 animate-spin" />
          : <Trash2 className="size-3" />}
      </button>
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
    <div className="flex flex-col overflow-hidden rounded-2xl border border-pd-border bg-pd-surface">
      <div className="flex items-center gap-2 border-b border-pd-border px-[22px] py-4">
        <Book className="size-4 text-[#6B4EE6]" aria-hidden="true" />
        <p className="font-pd-display text-[15px] font-semibold text-pd-ink">
          History book
        </p>
      </div>

      <div className="max-h-[330px] min-h-[120px] flex-1 space-y-2.5 overflow-y-auto px-[22px] py-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="size-[26px] shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))
        ) : isEmpty ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
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
              <div className="space-y-4 pt-1">
                {notes.length > 0 && (
                  <p className="text-[10px] font-semibold uppercase tracking-[.04em] text-pd-faint">
                    Activity
                  </p>
                )}
                {activity.map((a) => (
                  <ActivityItem key={a.id} {...a} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-pd-border px-[22px] py-3"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Add a note about ${clientName || "this client"}…`}
          aria-label="Add a note"
          maxLength={2000}
          disabled={sending}
          className="h-[38px] flex-1 rounded-[10px] border-pd-border text-[13px]"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Save note"
          className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#6B4EE6] text-white transition hover:bg-[#5B3FD6] disabled:opacity-50"
        >
          {sending
            ? <Loader2 className="size-4 animate-spin" />
            : <Send className="size-4" />}
        </button>
      </form>
    </div>
  )
}
