"use client"

import { useRef, useState } from "react"
import { SendHorizontal } from "lucide-react"
import { COMPOSER_INPUT_ID } from "./LeadHeader"
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
      className="rounded-[22px] border border-pd-border bg-pd-surface p-2.5 shadow-[0_14px_34px_-12px_rgba(24,24,27,0.18)] transition-shadow focus-within:shadow-[0_14px_34px_-12px_rgba(24,24,27,0.18),0_0_0_4px_rgba(91,63,214,0.12)]"
    >
      {isEmail && (
        <input
          aria-label="Subject"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mb-1 w-full border-b border-pd-divider bg-transparent px-3 pb-2 pt-1 text-[13.5px] font-medium text-pd-ink outline-none placeholder:text-pd-faint"
        />
      )}
      <div className="flex items-end gap-2.5">
        <div className="flex shrink-0 rounded-full bg-pd-canvas p-[3px]" role="group" aria-label="Channel">
          {CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={channel === c}
              onClick={() => setChannel(c)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                channel === c ? "bg-pd-ink text-white" : "text-pd-muted hover:text-pd-ink"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <textarea
          id={COMPOSER_INPUT_ID}
          rows={isEmail ? 3 : 1}
          placeholder="Type a message…"
          aria-label="Message"
          value={body}
          maxLength={1600}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          className="max-h-40 min-h-[38px] flex-1 resize-none bg-transparent py-2 text-[13.5px] leading-snug text-pd-ink outline-none placeholder:text-pd-faint [field-sizing:content]"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-pd-primary text-white shadow-[0_6px_14px_-6px_rgba(91,63,214,0.7)] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100"
        >
          <SendHorizontal className="size-4" aria-hidden="true" />
        </button>
      </div>
      {reason && <p className="px-3 pb-1 pt-2 text-[11.5px] text-pd-subtle">{reason}</p>}
      {error && (
        <p role="alert" className="px-3 pb-1 pt-2 text-[11.5px] text-pd-danger">
          {error}
        </p>
      )}
    </form>
  )
}
