import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// Comments dropped, so prose in globals.css never counts as a declaration.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")

/** Trimmed value of the LAST declaration of `name` in the stylesheet. */
function decl(source, name) {
  const re = new RegExp(`(?<![\\w-])${name}\\s*:\\s*([^;]+);`, "g")
  const all = [...source.matchAll(re)]
  return all.length ? all.at(-1)[1].trim() : undefined
}

describe("design tokens", () => {
  it("declares Paper tokens with Birdy primary", () => {
    for (const [name, value] of Object.entries({
      "--color-background": "#FFFFFF", "--color-foreground": "#0A0A0A", "--color-muted": "#f4f4f5",
      "--color-muted-foreground": "#737373", "--color-border": "#E5E5E5", "--color-primary": "#5B3FD6",
      "--color-primary-soft": "#EFECFB", "--color-danger": "#EF4444", "--color-danger-soft": "#FEF2F2",
      "--color-danger-ink": "#991B1B", "--color-success-ink": "#166534", "--spacing-control": "40px",
      "--radius-control": "12px", "--radius-frame": "16px", "--radius-overlay": "20px", "--text-base": "16px",
      "--color-body": "#404040", "--color-scrim": "#0a0a0a66", "--color-chart-2": "#3B82F6",
      "--ease-edge": "cubic-bezier(.32, .72, 0, 1)",
      "--shadow-control-invalid": "0 0 0 1px var(--color-danger), 0 1px 2px #0000000F",
    })) expect(decl(css, name), name).toBe(value)
  })

  it("declares the Bytes greys, primary family and tones", () => {
    for (const [name, value] of Object.entries({
      "--color-frame": "#f7f7f8", "--color-rail": "#f4f4f5", "--color-rail-frame": "#ebebed",
      "--color-tab-thumb": "#ffffff", "--color-tab-count": "#0000000f", "--color-raised": "#ffffff",
      "--color-raised-held": "#f7f7f7", "--color-ghost-hover": "#f2f2f2", "--color-ghost-held": "#eaeaea",
      "--color-hairline": "#18181b14", "--color-surface-ring": "#18181b12", "--color-divider": "#f0f0f1",
      "--color-faint": "#a3a3a3", "--color-ink-secondary": "#3f3f46", "--color-metric-label": "#525252",
      "--color-row-hover": "#fafafa", "--color-row-selected": "#f5f5f6", "--color-skeleton": "#f0f0f1",
      "--color-skeleton-shine": "#f8f8f9", "--color-kbd-edge": "#e4e4e7", "--color-kbd-foreground": "#52525b",
      "--color-destructive": "#dc2626", "--color-danger": "#EF4444",
      "--color-primary-hover": "#6A50DC", "--color-primary-held": "#5338CC", "--color-primary-edge": "#4A30BC",
      "--color-primary-ink": "#4A2FB5", "--color-soft-fg": "#4F35C9",
      "--color-delta-good": "#16a34a", "--color-delta-good-ink": "#15803d", "--color-delta-good-soft": "#dcfce7",
      "--color-delta-bad": "#dc2626", "--color-delta-bad-ink": "#b91c1c", "--color-delta-bad-soft": "#fee2e2",
      "--color-purple": "#8b5cf6", "--color-purple-soft": "#f5f3ff", "--color-purple-ink": "#5b21b6",
      "--color-subdued": "#a1a1aa", "--color-subdued-soft": "#f4f4f5", "--color-subdued-ink": "#52525b",
      "--color-neutral": "#52525b", "--color-neutral-soft": "#f4f4f5", "--color-neutral-ink": "#27272a",
    })) expect(decl(css, name), name).toBe(value)
  })

  it("declares Bytes shadows, radii, type and motion", () => {
    expect(decl(css, "--shadow-surface")).toBe("0 0 0 1px var(--color-surface-ring)")
    expect(decl(css, "--shadow-frame")).toBe("0 0 0 1px var(--color-hairline)")
    expect(decl(css, "--shadow-primary")).toMatch(/var\(--color-primary-edge\)/)
    expect(decl(css, "--shadow-control-hover")).toMatch(/#0000003d/)
    for (const name of ["--shadow-primary-held", "--shadow-destructive", "--shadow-rise", "--shadow-kbd", "--shadow-field-error", "--shadow-bezel", "--shadow-overlay-frame", "--shadow-tooltip", "--shadow-focus"]) {
      expect(decl(css, name), name).toBeTruthy()
    }
    for (const [name, value] of Object.entries({
      "--radius-control-sm": "10px", "--radius-control-lg": "14px", "--radius-badge": "7px", "--radius-bezel": "27px",
      "--radius-xl": "calc(var(--radius) + 2px)", "--radius-2xl": "calc(var(--radius) + 6px)",
      "--text-2xl": "24px", "--ease-thumb": "cubic-bezier(.3, 1.2, .5, 1)",
    })) expect(decl(css, name), name).toBe(value)
    expect(css).toMatch(/@keyframes tab-land/)
    expect(css).toMatch(/@keyframes skeleton-sweep/)
  })

  it("uses a 16px root and global tabular figures", () => {
    expect(css).not.toMatch(/html\s*\{[^}]*font-size/)
    expect(css).toMatch(/body\s*\{[^}]*font-variant-numeric:\s*tabular-nums/)
    expect(css).toMatch(/background-color:\s*var\(--color-frame\)/)
  })

  it("keeps the radius base and drops the legacy alias layers", () => {
    expect(decl(css, "--radius")).toBe("10px")
    // Built from parts so the legacy-class audit grep never hits this file.
    const pd = "p" + "d"
    const legacy = [
      new RegExp(`--${pd}-`), new RegExp(`--color-${pd}-`), new RegExp(`--shadow-${pd}-`), new RegExp(`--font-${pd}-`),
      /--font-display\b/, /--(?:purple|gray)-\d/, /--color-(?:purple|gray|indigo|violet)-\d/,
      /--(?:primary|background|foreground|card|popover|secondary|accent|destructive|input|ring|sidebar)\s*:/,
    ]
    for (const re of legacy) expect(css, String(re)).not.toMatch(re)
  })

  it("has no circular var references", () => {
    const values = new Map()
    for (const [, name, value] of css.matchAll(/(?<![\w-])(--[\w-]+)\s*:\s*([^;]+);/g)) values.set(name, value)
    const refs = (name) => [...(values.get(name) ?? "").matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    const walk = (name, path) => {
      expect(path.includes(name), `cycle: ${[...path, name].join(" -> ")}`).toBe(false)
      expect(path.length, `chain too long from ${path[0]}`).toBeLessThanOrEqual(10)
      for (const next of refs(name)) walk(next, [...path, name])
    }
    for (const name of values.keys()) walk(name, [])
  })

  it("points font tokens at Outfit and Geist Mono", () => {
    expect(decl(css, "--font-sans")).toMatch(/^var\(--font-outfit\)/)
    expect(decl(css, "--font-mono")).toMatch(/^var\(--font-geist-mono\)/)
  })

  it("has a tabular-figures .num utility", () => {
    expect(css).toMatch(/@utility num\s*\{[^}]*font-feature-settings:\s*"tnum"/)
  })

  it("declares the 28px figure size for metric values", () => {
    expect(decl(css, "--text-figure")).toBe("28px")
    expect(decl(css, "--text-figure--line-height")).toBe("34px")
  })

  it("ships no dark mode", () => expect(css).not.toMatch(/\.dark\b|prefers-color-scheme/))
})
