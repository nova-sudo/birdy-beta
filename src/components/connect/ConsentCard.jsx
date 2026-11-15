"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Button } from "@/components/ui/button"
import { API_BASE_URL } from "@/lib/api"
import { pdFontClass } from "@/lib/pd-fonts"
import { cn } from "@/lib/utils"

const OPTIONS = [
  {
    value: "read",
    title: "View my data",
    body: "Ask about clients, leads, ads, alerts and the agent. Nothing gets changed.",
  },
  {
    value: "write",
    title: "View and make changes",
    body: "Also create alerts, edit notes and targets, and run the agent. Changes to live ads always ask you first.",
  },
]

const call = (path, init = {}) =>
  fetch(`${API_BASE_URL}${path}`, { credentials: "include", ...init })

function readEmail() {
  try {
    return JSON.parse(localStorage.getItem("user"))?.email || null
  } catch {
    return null
  }
}

function Shell({ children }) {
  return (
    <div className={`${pdFontClass} flex min-h-dvh items-center justify-center bg-pd-canvas px-4 py-10`}>
      <div className="w-full max-w-[440px] rounded-[18px] border border-pd-border bg-white p-7">{children}</div>
    </div>
  )
}

export default function ConsentCard({ requestId }) {
  const [req, setReq] = useState(null)
  const [access, setAccess] = useState("write")
  const [error, setError] = useState(null) // {kind: "expired"|"billing"|"message", text?}
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState(null)

  const loginUrl = `/login?redirect=${encodeURIComponent(`/connect/authorize?request=${encodeURIComponent(requestId ?? "")}`)}`

  useEffect(() => {
    setEmail(readEmail())
    if (!requestId) {
      setError({ kind: "expired" })
      return
    }
    let cancelled = false
    call(`/api/oauth/requests/${encodeURIComponent(requestId)}`)
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 401) return window.location.assign(loginUrl)
        if (!res.ok) return setError({ kind: res.status === 404 ? "expired" : "message", text: "Something went wrong. Try connecting again." })
        const data = await res.json()
        setReq(data)
        setAccess(data.requested_access === "read" ? "read" : "write")
      })
      .catch(() => !cancelled && setError({ kind: "message", text: "Couldn't reach Birdy. Check your connection and try again." }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  async function decide(allow) {
    setBusy(true)
    setError(null)
    try {
      const res = await call(`/api/oauth/requests/${encodeURIComponent(requestId)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allow, access }),
      })
      if (res.status === 401) return window.location.assign(loginUrl)
      if (res.ok) {
        const { redirect_to } = await res.json()
        return window.location.assign(redirect_to)
      }
      if (res.status === 404) setError({ kind: "expired" })
      else if (res.status === 402) setError({ kind: "billing" })
      else {
        const body = await res.json().catch(() => ({}))
        setError({ kind: "message", text: body.detail || "Something went wrong. Try again." })
      }
    } catch {
      setError({ kind: "message", text: "Couldn't reach Birdy. Check your connection and try again." })
    }
    setBusy(false)
  }

  const clientName = req?.client_name

  const errorBox = error && (
    <p role="alert" className="mt-4 rounded-lg bg-pd-danger-bg px-3 py-2 text-[13px] text-pd-danger">
      {error.kind === "expired" && (
        <>This connection request expired. Go back to {clientName || "the app"} and try connecting again.</>
      )}
      {error.kind === "billing" && (
        <>
          An active Birdy subscription is needed to connect.{" "}
          <Link href="/settings?tab=billing" className="font-semibold underline">
            Go to billing
          </Link>
        </>
      )}
      {error.kind === "message" && error.text}
    </p>
  )

  if (!req) {
    return <Shell>{errorBox || <p className="text-center text-sm text-pd-subtle" role="status">Loading…</p>}</Shell>
  }

  return (
    <Shell>
      <div className="mb-[18px] flex items-center justify-center gap-3">
        <BirdyAvatar size={56} tone="tint" />
        <div className="w-10 border-t-2 border-dashed border-pd-border-strong" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="grid size-14 place-items-center rounded-[14px] bg-pd-ink text-xl font-bold text-white"
        >
          {(clientName || "?").trim().charAt(0).toUpperCase()}
        </div>
      </div>
      <h1 className="text-center text-xl font-semibold text-pd-ink">
        {clientName} wants to connect to your Birdy account
      </h1>
      {email && <p className="mt-1 text-center text-[12.5px] text-pd-subtle">Signed in as {email}</p>}

      <div role="radiogroup" aria-label="Access" className="mt-[18px]">
        {OPTIONS.map((o) => {
          const on = access === o.value
          return (
            <label
              key={o.value}
              className={cn(
                "mt-2.5 flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3",
                on ? "border-pd-primary bg-[#FBFAFF]" : "border-pd-border",
              )}
            >
              <input
                type="radio"
                name="access"
                value={o.value}
                checked={on}
                onChange={() => setAccess(o.value)}
                disabled={busy}
                className="peer sr-only"
                aria-label={o.title}
              />
              <i
                aria-hidden="true"
                className={cn(
                  "mt-0.5 size-[18px] flex-none rounded-full border-pd-primary peer-focus-visible:ring-2 peer-focus-visible:ring-pd-primary peer-focus-visible:ring-offset-2",
                  on ? "border-[5px]" : "border-2 border-pd-border-strong",
                )}
              />
              <span>
                <b className="block font-semibold text-pd-ink">{o.title}</b>
                <span className="text-[12.5px] text-pd-subtle">{o.body}</span>
              </span>
            </label>
          )
        })}
      </div>

      {errorBox}

      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
          Cancel
        </Button>
        <Button className="flex-[2]" disabled={busy} onClick={() => decide(true)}>
          Allow
        </Button>
      </div>
      <p className="mt-4 text-center text-xs text-pd-subtle">
        You&apos;ll be sent back to <b className="text-pd-ink">{req.redirect_host}</b>. You can disconnect anytime in
        Settings → Connect to AI.
      </p>
    </Shell>
  )
}
