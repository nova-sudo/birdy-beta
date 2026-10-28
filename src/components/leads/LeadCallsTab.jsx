"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Play, PhoneIncoming, PhoneOutgoing } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { formatDuration } from "@/lib/lead-detail"

// ─── Lead detail: Calls tab ─────────────────────────────────────────────────
// Call history, newest first: direction · status, when, how long, and the
// recording and transcript when the call log has them. CallMedia is shared
// with the thread's call cards.
//
// Calls made in GoHighLevel carry `recording_path` / `transcript_path` instead
// of a recording URL: GHL needs the agency's token, so the audio comes
// through Birdy's backend, fetched only when someone presses play.

const whenFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

export function capitalise(word) {
  if (!word) return ""
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** "17 Jul, 4:59 PM", or "" when there is no usable time. */
export function formatCallTime(iso) {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const p = Object.fromEntries(whenFormat.formatToParts(date).map((x) => [x.type, x.value]))
  return `${p.day} ${p.month}, ${p.hour}:${p.minute} ${(p.dayPeriod || "").toUpperCase()}`.trim()
}

// Call logs come from several dialers; a transcript may be plain text or a
// list of segments.
function transcriptText(transcript) {
  if (!transcript) return ""
  if (typeof transcript === "string") return transcript
  if (Array.isArray(transcript)) {
    return transcript
      .map((s) => (typeof s === "string" ? s : [s?.speaker, s?.text].filter(Boolean).join(": ")))
      .filter(Boolean)
      .join("\n")
  }
  return transcript.text || ""
}

/**
 * The native player and a Transcript disclosure, each only when there is one.
 * A call the dialer sent without a recording says so, rather than showing
 * nothing to play.
 */
export function CallMedia({ call }) {
  if (call.recording_path) return <GhlCallMedia call={call} />
  const transcript = transcriptText(call.transcript)

  return (
    <div className="mt-2.5 space-y-2">
      {!call.recording_url && <p className="text-[11.5px] text-pd-subtle">No recording</p>}
      {call.recording_url && (
        <audio controls preload="none" src={call.recording_url} className="h-9 w-full">
          <a href={call.recording_url}>Download the recording</a>
        </audio>
      )}
      {transcript && (
        <details className="group rounded-lg border border-pd-border bg-pd-surface">
          <summary className="cursor-pointer select-none px-3 py-1.5 text-[12px] font-semibold text-pd-primary">
            Transcript
          </summary>
          <p className="max-h-60 overflow-y-auto whitespace-pre-line border-t border-pd-divider px-3 py-2 text-[12px] text-pd-body">
            {transcript}
          </p>
        </details>
      )}
    </div>
  )
}

const RECONNECT = "reconnect"

function ReconnectNote() {
  return (
    <p className="text-[11.5px] text-pd-subtle">
      Reconnect GoHighLevel to play call recordings.{" "}
      <Link href="/settings" className="font-semibold text-pd-primary hover:underline">
        Open Settings
      </Link>
    </p>
  )
}

/** A GHL call: "Play recording" loads the audio through the backend, then plays it. */
function GhlCallMedia({ call }) {
  // "idle" | "loading" | "ready" | "none" | "reconnect" | "error"
  const [state, setState] = useState("idle")
  const [src, setSrc] = useState(null)
  const audio = useRef(null)
  const mounted = useRef(true)

  // The object URL lives as long as the card.
  useEffect(() => () => src && URL.revokeObjectURL(src), [src])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (state === "ready") audio.current?.play?.()?.catch?.(() => {})
  }, [state])

  const load = async () => {
    if (state === "loading") return
    setState("loading")
    try {
      const res = await apiRequest(call.recording_path)
      if (!mounted.current) return
      if (res.status === 404) return setState("none")
      if (res.status === 409) return setState(RECONNECT)
      if (!res.ok) throw new Error(`The recording request failed (${res.status}).`)
      const blob = await res.blob()
      // A card that went away mid-download never makes a URL it can't revoke.
      if (!mounted.current) return
      setSrc(URL.createObjectURL(blob))
      setState("ready")
    } catch {
      if (mounted.current) setState("error")
    }
  }

  return (
    <div className="mt-2.5 space-y-2">
      {state === "ready" && src ? (
        <audio ref={audio} controls src={src} className="h-9 w-full" />
      ) : state === "none" ? (
        <p className="text-[11.5px] text-pd-subtle">No recording</p>
      ) : state === RECONNECT ? (
        <ReconnectNote />
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={state === "loading"}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-pd-primary-tint px-3 text-[12px] font-semibold text-pd-primary hover:bg-pd-primary-pale/60 disabled:cursor-wait disabled:opacity-70"
          >
            <Play className="size-3" aria-hidden="true" />
            {state === "loading" ? "Loading recording…" : "Play recording"}
          </button>
          {state === "error" && <span className="text-[11.5px] text-pd-danger">Couldn&apos;t load the recording.</span>}
        </div>
      )}
      <GhlTranscript path={call.transcript_path} />
    </div>
  )
}

/** The GHL transcript, fetched the first time the disclosure opens. */
function GhlTranscript({ path }) {
  // "idle" | "loading" | "ready" | "reconnect" | "error"
  const [state, setState] = useState("idle")
  const [text, setText] = useState(null)

  const load = async () => {
    setState("loading")
    try {
      const res = await apiRequest(path)
      if (res.status === 409) return setState(RECONNECT)
      if (res.status === 404) {
        setText(null)
        return setState("ready")
      }
      if (!res.ok) throw new Error(`The transcript request failed (${res.status}).`)
      setText((await res.json())?.transcript || null)
      setState("ready")
    } catch {
      setState("error")
    }
  }

  if (!path) return null
  return (
    <details
      className="group rounded-lg border border-pd-border bg-pd-surface"
      onToggle={(e) => e.currentTarget.open && (state === "idle" || state === "error") && load()}
    >
      <summary className="cursor-pointer select-none px-3 py-1.5 text-[12px] font-semibold text-pd-primary">
        Transcript
      </summary>
      <div className="max-h-60 overflow-y-auto border-t border-pd-divider px-3 py-2 text-[12px] text-pd-body">
        {state === "loading" && <p className="text-pd-subtle">Loading transcript…</p>}
        {state === "ready" && (text ? <p className="whitespace-pre-line">{text}</p> : <p className="text-pd-subtle">No transcript for this call.</p>)}
        {state === RECONNECT && <ReconnectNote />}
        {state === "error" && (
          <p className="text-pd-subtle">
            Couldn&apos;t load the transcript.{" "}
            <button type="button" onClick={load} className="font-semibold text-pd-primary hover:underline">
              Try again
            </button>
          </p>
        )}
      </div>
    </details>
  )
}

export function LeadCallsTab({ calls }) {
  const list = [...(calls || [])].sort((a, b) => new Date(b.started_at) - new Date(a.started_at))

  return (
    <div>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-pd-subtle">
        Call history · {list.length}
      </h3>
      {list.length === 0 ? (
        <p className="text-[12.5px] text-pd-subtle">No calls logged for this lead yet.</p>
      ) : (
        <ul className="divide-y divide-pd-divider">
          {list.map((call) => {
            const Icon = call.direction === "inbound" ? PhoneIncoming : PhoneOutgoing
            const sub = [formatCallTime(call.started_at), call.source].filter(Boolean).join(" · ")
            return (
              <li key={call.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-pd-primary-tint text-pd-primary">
                    <Icon className="size-[14px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-pd-ink">
                      {[capitalise(call.direction) || "Call", call.status].filter(Boolean).join(" · ")}
                    </p>
                    {sub && <p className="mt-0.5 text-[11.5px] text-pd-subtle">{sub}</p>}
                  </div>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-pd-ink">
                    {formatDuration(call.duration_seconds)}
                  </span>
                </div>
                <CallMedia call={call} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
