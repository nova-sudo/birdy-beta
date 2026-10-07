"use client"

import { useEffect } from "react"
import Link from "next/link"

// Catches a crash in any page, so the sidebar and header stay usable and the
// person gets a way back, instead of Next's bare "Application error" screen.
// The error still goes to the console, where it can be read off for a report.
export default function PageError({ error, reset }) {
  useEffect(() => {
    console.error("[Birdy] page error:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="font-pd-display text-[22px] font-semibold text-pd-ink">Something went wrong on this page</h1>
      <p className="max-w-[420px] text-[13.5px] leading-[1.5] text-pd-muted">
        Try again. If it keeps happening, tell us which page you were on
        {error?.digest ? <> and quote this reference: <code className="font-mono text-[12px]">{error.digest}</code></> : null}.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-[10px] bg-pd-primary px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-[10px] border border-pd-border px-4 py-2 text-[13px] text-pd-body hover:border-pd-border-strong"
        >
          Go to the dashboard
        </Link>
      </div>
    </div>
  )
}
