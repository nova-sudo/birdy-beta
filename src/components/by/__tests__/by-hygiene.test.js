import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const BY_ROOT = path.resolve(__dirname, "..")

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p)
    return [p]
  })
}

const files = walk(BY_ROOT).filter((f) => /\.(js|jsx)$/.test(f))
const rel = (f) => path.relative(BY_ROOT, f)
const read = (f) => fs.readFileSync(f, "utf8")

describe("by kit hygiene", () => {
  it("finds files to scan", () => {
    expect(files.length).toBeGreaterThan(10)
  })

  // The kit is built from role tokens only. A colour, a raw ramp step or an
  // older component reaching in is how two design systems start to blend.
  it.each([
    ["hex colours", /#[0-9a-fA-F]{3,8}\b/],
    ["raw ramp variables", /--by-(grey|purple|red|amber|green|blue|teal)-/],
    ["imports from ds", /from\s+["']@\/components\/ds/],
    ["imports from ui", /from\s+["']@\/components\/ui/],
    ["pd-* classes", /["'`\s]pd-[a-z]/],
    ["stock Tailwind palette colours", /\b(bg|text|border|ring|outline|stroke|fill)-(gray|slate|zinc|neutral|purple|violet|indigo|red|amber|green|blue|teal)-\d{2,3}\b/],
  ])("has no %s", (_name, re) => {
    expect(files.filter((f) => re.test(read(f))).map(rel)).toEqual([])
  })

  // A hook or context in a module without the directive breaks every route
  // that imports the barrel from a server component; jsdom never notices.
  it("marks every module that uses hooks or context as a client module", () => {
    const hits = files
      .filter((f) => /\b(createContext|use(State|Effect|Context|Ref|Memo|Callback|LayoutEffect|Id|Reducer))\(/.test(read(f)) && !/^\s*["']use client["']/.test(read(f)))
      .map(rel)
    expect(hits).toEqual([])
  })

  it("uses the kit's own cn, which understands the by- scales", () => {
    expect(files.filter((f) => /from\s+["']@\/lib\/utils["']/.test(read(f))).map(rel)).toEqual([])
  })
})
