"use client"

// Last resort for a crash in the root layout itself (the shell, sidebar or
// header), which app/error.jsx cannot catch because it renders inside them.
// It replaces the whole document, so it carries its own html and body.
export default function GlobalError({ error, reset }) {
  if (typeof console !== "undefined") console.error("[Birdy] app error:", error)
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F6F6F4", color: "#18181B" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 16, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Birdy hit a problem</h1>
          <p style={{ fontSize: 14, color: "#6B6480", maxWidth: 420, margin: 0 }}>
            Reload to try again. If it keeps happening, tell us what you were doing
            {error?.digest ? ` and quote this reference: ${error.digest}` : ""}.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 8, padding: "8px 16px", borderRadius: 10, border: 0, background: "#5B3FD6", color: "#fff", fontSize: 13, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
