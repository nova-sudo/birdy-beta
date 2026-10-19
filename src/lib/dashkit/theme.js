import { createTheme } from "dashkit/react"

/**
 * Every dashkit theme variable (`DK_VARS`), mapped onto a Birdy token, so
 * dashboards follow the product's colours, radius, shadows and fonts rather
 * than dashkit's built-in copy of them. References are `var(--…)` so a token
 * change flows through without touching this file. Two values are not tokens:
 * - `--dk-chart-2` is #2E9E8F, the teal of dashkit's checked chart palette;
 *   Birdy has no token for a second series colour.
 * - `--dk-radius` is Birdy's card radius (PdCard's rounded-2xl), which only
 *   exists as a Tailwind theme value, so it is spelled out here.
 * The fonts point at the next/font variables on <html> (`--font-pd-*` are
 * Tailwind theme values, inlined at build time, not runtime variables).
 *
 * globals.css carries the same declarations as plain CSS in an unlayered
 * `.dk-root` block after dashkit's stylesheet, because a stylesheet cannot
 * import a JS string. This module stays the source of truth and the test
 * checks both against `DK_VARS`; keep them in step.
 */
export const DK_THEME_VARS = {
  // Surfaces and text
  "--dk-bg": "var(--pd-canvas)",
  "--dk-card": "var(--pd-surface)",
  "--dk-fg": "var(--pd-ink)",
  "--dk-body": "var(--pd-body)",
  "--dk-muted": "var(--pd-muted)",
  "--dk-subtle": "var(--pd-subtle)",
  "--dk-border": "var(--pd-border)",
  "--dk-border-strong": "var(--pd-border-strong)",
  "--dk-table-head": "var(--pd-table-head)",
  // Accent
  "--dk-accent": "var(--pd-primary)",
  "--dk-accent-tint": "var(--pd-primary-tint)",
  "--dk-accent-pale": "var(--pd-primary-pale)",
  "--dk-accent-fg": "var(--primary-foreground)",
  // Status
  "--dk-success": "var(--pd-success)",
  "--dk-success-bg": "var(--pd-success-bg)",
  "--dk-danger": "var(--pd-danger)",
  "--dk-danger-bg": "var(--pd-danger-bg)",
  "--dk-warning": "var(--pd-warning)",
  "--dk-warning-bg": "var(--pd-warning-bg)",
  "--dk-info": "var(--pd-info)",
  // Charts
  "--dk-chart-1": "var(--pd-primary)",
  "--dk-chart-2": "#2E9E8F",
  "--dk-chart-3": "var(--pd-warning)",
  "--dk-chart-4": "var(--pd-faint)",
  // Shape and type
  "--dk-radius": "calc(var(--radius) + 8px)",
  "--dk-shadow": "var(--shadow-sm)",
  "--dk-shadow-pop": "var(--pd-shadow-popover)",
  "--dk-font": "var(--font-inter)",
  "--dk-font-display": "var(--font-bricolage)",
}

export const dkTheme = createTheme(DK_THEME_VARS)
