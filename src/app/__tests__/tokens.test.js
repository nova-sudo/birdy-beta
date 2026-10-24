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
      "--color-background": "#FFFFFF", "--color-foreground": "#0A0A0A", "--color-muted": "#F7F7F7",
      "--color-muted-foreground": "#737373", "--color-border": "#E5E5E5", "--color-primary": "#5B3FD6",
      "--color-primary-soft": "#EFECFB", "--color-danger": "#EF4444", "--color-danger-soft": "#FEF2F2",
      "--color-danger-ink": "#991B1B", "--color-success-ink": "#166534", "--spacing-control": "40px",
      "--radius-control": "12px", "--radius-frame": "16px", "--radius-overlay": "20px", "--text-base": "16px",
      "--color-body": "#404040", "--color-scrim": "#0A0A0A2E", "--color-chart-2": "#3B82F6",
      "--ease-edge": "cubic-bezier(.32, .72, 0, 1)",
      "--shadow-control-invalid": "0 0 0 1px var(--color-danger), 0 1px 2px #0000000F",
    })) expect(decl(css, name), name).toBe(value)
  })

  it("aliases shadcn and pd vars to tokens", () => {
    expect(decl(css, "--primary")).toBe("var(--color-primary)")
    expect(decl(css, "--background")).toBe("var(--color-background)")
    expect(decl(css, "--radius")).toBe("12px")
    expect(decl(css, "--pd-ink")).toBe("var(--color-foreground)")
    expect(decl(css, "--pd-canvas")).toBe("var(--color-muted)")
    expect(decl(css, "--pd-primary-tint")).toBe("var(--color-primary-soft)")
    expect(decl(css, "--pd-shadow-popover")).toBe("var(--shadow-floating)")
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
    expect(decl(css, "--font-pd-display")).toBe("var(--font-outfit)")
    expect(decl(css, "--font-pd-body")).toBe("var(--font-outfit)")
    expect(decl(css, "--font-display")).toBe("var(--font-outfit)")
  })

  it("has a tabular-figures .num utility", () => {
    expect(css).toMatch(/@utility num\s*\{[^}]*font-feature-settings:\s*"tnum"/)
  })

  it("ships no dark mode", () => expect(css).not.toMatch(/\.dark\b|prefers-color-scheme/))
})
