"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

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
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Go to the dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
