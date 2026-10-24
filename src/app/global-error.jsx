"use client"

import "./globals.css"
import { fontVariables } from "@/lib/fonts"
import { Button } from "@/components/ui/button"

// Last resort for a crash in the root layout itself (the shell, sidebar or
// header), which app/error.jsx cannot catch because it renders inside them.
// It replaces the whole document, so it carries its own html and body — and
// its own stylesheet and fonts, since the root layout that normally loads
// them is the thing that just failed.
export default function GlobalError({ error, reset }) {
  if (typeof console !== "undefined") console.error("[Birdy] app error:", error)
  return (
    <html lang="en" className={fontVariables}>
      <body className="antialiased bg-pd-canvas text-pd-ink">
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
          <h1 className="font-pd-display text-[22px] font-semibold text-pd-ink">Birdy hit a problem</h1>
          <p className="max-w-[420px] text-[14px] text-pd-muted">
            Reload to try again. If it keeps happening, tell us what you were doing
            {error?.digest ? ` and quote this reference: ${error.digest}` : ""}.
          </p>
          <Button type="button" onClick={() => reset()} className="mt-2">
            Try again
          </Button>
        </div>
      </body>
    </html>
  )
}
