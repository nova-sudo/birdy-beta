import { createTheme } from "dashkit/react"

/**
 * Every dashkit theme variable (`DK_VARS`), mapped onto a design-system token
 * (the `--color-*`, `--radius-*`, `--shadow-*` vars declared in `@theme` in
 * globals.css), so dashboards follow the product's colours, radius, shadows
 * and fonts rather than dashkit's built-in copy of them. References are
 * `var(--…)` so a token change flows through without touching this file, and
 * no value is a literal: the extra series hues (`--dk-chart-6..8`) are tokens
 * too, so a trend split by client can draw eight lines with no repeated hue.
 * `--dk-font*` point at the next/font variable on <html>.
 *
 * globals.css carries the same declarations as plain CSS in an unlayered
 * `.dk-root` block after dashkit's stylesheet, because a stylesheet cannot
 * import a JS string. This module stays the source of truth and the test
 * checks both against `DK_VARS`; keep them in step.
 */
export const DK_THEME_VARS = {
  // Surfaces and text
  "--dk-bg": "var(--color-muted)",
  "--dk-card": "var(--color-background)",
  "--dk-fg": "var(--color-foreground)",
  "--dk-body": "var(--color-body)",
  "--dk-muted": "var(--color-muted-foreground)",
  "--dk-subtle": "var(--color-muted-foreground)",
  "--dk-border": "var(--color-border)",
  "--dk-border-strong": "color-mix(in srgb, var(--color-border), #000 8%)",
  "--dk-table-head": "var(--color-muted)",
  // Accent
  "--dk-accent": "var(--color-primary)",
  "--dk-accent-tint": "var(--color-primary-soft)",
  "--dk-accent-pale": "color-mix(in srgb, var(--color-primary) 35%, transparent)",
  "--dk-accent-fg": "var(--color-primary-foreground)",
  // Status
  "--dk-success": "var(--color-success)",
  "--dk-success-bg": "var(--color-success-soft)",
  "--dk-danger": "var(--color-danger)",
  "--dk-danger-bg": "var(--color-danger-soft)",
  "--dk-warning": "var(--color-warning)",
  "--dk-warning-bg": "var(--color-warning-soft)",
  "--dk-info": "var(--color-info)",
  // Charts
  "--dk-chart-1": "var(--color-chart-1)",
  "--dk-chart-2": "var(--color-chart-2)",
  "--dk-chart-3": "var(--color-chart-3)",
  "--dk-chart-4": "var(--color-chart-4)",
  "--dk-chart-5": "var(--color-chart-5)",
  "--dk-chart-6": "var(--color-chart-6)",
  "--dk-chart-7": "var(--color-chart-7)",
  "--dk-chart-8": "var(--color-chart-8)",
  // Shape and type
  "--dk-radius": "var(--radius-frame)",
  "--dk-shadow": "var(--shadow-surface)",
  "--dk-shadow-pop": "var(--shadow-floating)",
  "--dk-font": "var(--font-outfit)",
  "--dk-font-display": "var(--font-outfit)",
}

export const dkTheme = createTheme(DK_THEME_VARS)
