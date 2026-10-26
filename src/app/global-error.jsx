"use client"

import "./globals.css"
import { fontVariables } from "@/lib/fonts"
import { Button } from "@/components/ds"

// Last resort for a crash in the root layout itself (the shell, sidebar or
// header), which app/error.jsx cannot catch because it renders inside them.
// It replaces the whole document, so it carries its own html and body — and
// its own stylesheet and fonts, since the root layout that normally loads
// them is the thing that just failed. Layout and colours are inline, with
// keyword fallbacks, so the page still reads if the stylesheet doesn't arrive.
export default function GlobalError({ error, reset }) {
  if (typeof console !== "undefined") console.error("[Birdy] app error:", error)
  return (
    <html lang="en" className={fontVariables}>
      <body
        className="font-sans antialiased"
        style={{
          margin: 0,
          background: "var(--color-muted, canvas)",
          color: "var(--color-foreground, canvastext)",
        }}
      >
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <h1 className="text-xl font-semibold" style={{ margin: 0 }}>Birdy hit a problem</h1>
          <p
            className="text-sm"
            style={{ margin: 0, maxWidth: "420px", color: "var(--color-muted-foreground, graytext)" }}
          >
            Reload to try again. If it keeps happening, tell us what you were doing
            {error?.digest ? ` and quote this reference: ${error.digest}` : ""}.
          </p>
          <Button type="button" variant="primary" onClick={() => reset()}>
            Try again
          </Button>
        </div>
      </body>
    </html>
  )
}
