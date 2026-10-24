"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button, ErrorState } from "@/components/ds"

// Catches a crash in any page, so the sidebar and header stay usable and the
// person gets a way back, instead of Next's bare "Application error" screen.
// The error still goes to the console, where it can be read off for a report.
export default function PageError({ error, reset }) {
  useEffect(() => {
    console.error("[Birdy] page error:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4">
      <ErrorState
        className="max-w-md"
        title="Something went wrong on this page"
        description={
          <>
            Try again. If it keeps happening, tell us which page you were on
            {error?.digest ? <> and quote this reference: <code className="font-mono text-xs">{error.digest}</code></> : null}.
          </>
        }
        onRetry={reset}
      />
      <Button asChild variant="outline">
        <Link href="/dashboard">Go to the dashboard</Link>
      </Button>
    </div>
  )
}
