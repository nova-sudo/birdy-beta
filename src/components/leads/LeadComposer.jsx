"use client"

import { useRef, useState } from "react"
import { SendHorizontal } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { cn } from "@/lib/utils"

// ─── Lead detail: composer ──────────────────────────────────────────────────
// Sends one SMS or email to the lead through POST /api/leads/contact/{id}/
// messages. The button doubles as the in-flight guard: it is disabled from the
// click until the answer, so a double click is one request. On any failure the
// draft stays and the backend's `detail` is shown under the box, except a 504
// (send outcome unknown): the draft is cleared and onUnconfirmed reloads the thread.

const CHANNELS = ["SMS", "Email"]

// FastAPI sends `detail` as a string, or as a list of {msg} for a 422.
function errorDetail(detail) {
  if (typeof detail === "string" && detail) return detail
  const first = Array.isArray(detail) ? detail[0]?.msg : null
  return typeof first === "string" && first ? first : "Couldn't send the message."
}

export function LeadComposer({ contact, contactId, status, onSent, onUnconfirmed }) {
  const [channel, setChannel] = useState("SMS")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  // Set synchronously so a second submit can never start before the re-render.
  const inFlight = useRef(false)

  const isEmail = channel === "Email"
  const hasBody = body.trim() !== "" && (!isEmail || subject.trim() !== "")
  const reason =
    status !== "ok"
      ? status === "reconnect"
        ? "Reconnect GoHighLevel to send messages."
        : status === "unavailable"
          ? "Messaging isn't available right now."
          : "Waiting for messages to load."
      : isEmail
        ? contact?.email
          ? subject.trim() === "" && body.trim() !== ""
            ? "Add a subject"
            : null
          : "No email address"
        : contact?.phone
          ? null
          : "No phone number"
  const canSend = !reason && hasBody && !sending

  const send = async () => {
    if (!canSend || inFlight.current) return
    inFlight.current = true
    setSending(true)
    setError(null)
    try {
      const payload = { channel, message: body.trim() }
      if (isEmail) payload.subject = subject.trim()
      const res = await apiRequest(`/api/leads/contact/${encodeURIComponent(contactId ?? contact.id)}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(errorDetail(data?.detail))
        if (res.status === 504) {
          // Outcome unknown: the message may have been delivered. Drop the draft
          // so a second click can't double-send, and re-read the thread.
          setBody("")
          setSubject("")
          onUnconfirmed?.()
        }
        return
      }
      onSent?.(data.message)
      setBody("")
      setSubject("")
    } catch (err) {
      setError(err?.message || "The message couldn't be sent.")
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  const onKeyDown = (e) => {
    // Enter that confirms an IME candidate is not a send.
    if (e.nativeEvent?.isComposing || e.keyCode === 229) return
    if (e.key === "Enter" && !e.shiftKey && !isEmail) {
      e.preventDefault()
      send()
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
      className="rounded-2xl border border-pd-border bg-pd-surface p-3 shadow-sm"
    >
      <div className="mb-2 flex items-center gap-1.5" role="group" aria-label="Channel">
        {CHANNELS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={channel === c}
            onClick={() => setChannel(c)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
              channel === c ? "bg-pd-primary-tint text-pd-primary" : "text-pd-subtle hover:text-pd-ink"
            )}
          >
            {c}
          </button>
        ))}
      </div>
      {isEmail && (
        <input
          aria-label="Subject"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mb-2 w-full rounded-lg border border-pd-border bg-pd-surface px-3 py-2 text-[13px] text-pd-ink outline-none focus:border-pd-primary"
        />
      )}
      <div className="flex items-end gap-2">
        <textarea
          rows={2}
          placeholder="Type a message…"
          aria-label="Message"
          value={body}
          maxLength={1600}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-pd-border bg-pd-surface px-3 py-2 text-[13px] text-pd-ink outline-none focus:border-pd-primary"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-pd-primary px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizontal className="size-3.5" aria-hidden="true" />
          Send
        </button>
      </div>
      {reason && <p className="mt-2 text-[11.5px] text-pd-subtle">{reason}</p>}
      {error && (
        <p role="alert" className="mt-2 text-[11.5px] text-pd-danger">
          {error}
        </p>
      )}
    </form>
  )
}
