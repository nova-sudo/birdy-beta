import { createTheme } from "dashkit/react"

/**
 * Maps every dashkit theme variable onto a Birdy token, so dashboards inherit
 * the product's colours, radius and fonts instead of dashkit's neutral defaults.
 * References are `var(--pd-*)` rather than literals so a token change (or dark
 * mode) flows through without touching this file.
 *
 * globals.css carries the same 14 declarations as plain CSS, because the
 * stylesheet cannot import a JS string. This module stays the source of truth
 * and the test asserts the mapping; keep the two in step.
 */
export const dkTheme = createTheme({
  "--dk-bg": "var(--pd-canvas)",
  "--dk-card": "var(--pd-surface)",
  "--dk-fg": "var(--pd-ink)",
  "--dk-muted": "var(--pd-muted)",
  "--dk-border": "var(--pd-border)",
  "--dk-accent": "var(--pd-primary)",
  "--dk-success": "var(--pd-success)",
  "--dk-danger": "var(--pd-danger)",
  "--dk-warning": "var(--pd-warning)",
  "--dk-info": "var(--pd-info)",
  "--dk-radius": "var(--radius)",
  "--dk-shadow": "var(--pd-shadow-popover)",
  "--dk-font": "var(--font-pd-body)",
  "--dk-font-display": "var(--font-pd-display)",
})
