import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const DS_ROOT = path.resolve(__dirname, "..")

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p)
    return [p]
  })
}

// Source files only: PORTED.md must be free to name what was stripped (PermissionGate, @bytes/ui).
const files = walk(DS_ROOT).filter((f) => /\.(js|jsx|css)$/.test(f))
const rel = (f) => path.relative(DS_ROOT, f)

describe("ds hygiene", () => {
  it("finds files to scan", () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it("does not scan markdown docs", () => {
    expect(files.filter((f) => f.endsWith(".md"))).toEqual([])
    expect(fs.existsSync(path.join(DS_ROOT, "PORTED.md"))).toBe(true)
  })

  it.each([
    ["raw hex", /#[0-9a-fA-F]{3,8}\b/],
    ["bytes alias", /@bytes\//],
    ["permission gating", /permission/i],
    ["nuqs", /nuqs/],
    ["remixicon", /@remixicon/],
    ["react-icons", /react-icons/],
  ])("no %s in src/components/ds/**", (_name, re) => {
    const hits = files.filter((f) => re.test(fs.readFileSync(f, "utf8"))).map(rel)
    expect(hits).toEqual([])
  })

  it("every ds .jsx component carries data-ds", () => {
    const missing = files
      .filter((f) => f.endsWith(".jsx"))
      .filter((f) => !fs.readFileSync(f, "utf8").includes("data-ds="))
      .map(rel)
    expect(missing).toEqual([])
  })
})
