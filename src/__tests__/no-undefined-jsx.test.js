import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

// A component used in JSX but never imported is a ReferenceError at runtime and
// nothing else catches it: this project has no ESLint config, and `next build`
// compiles the file happily because a JSX tag is just a call it cannot resolve
// until render. That is how `<TabsList>` shipped to production after its import
// was dropped — the whole client detail page threw "TabsList is not defined" on
// load, past a green build and a green test suite.
//
// The check is deliberately narrow to stay quiet: it flags a capitalised JSX
// tag only when the file mentions that name *nowhere except* inside a tag. Any
// import, any const/function/class, any destructured binding all count as a
// mention, so a locally-derived component (`const Icon = tab.icon`) is fine.

// vitest runs from the project root, so resolve src/ from cwd — the module URL
// is not a file: URL under the dev server.
const SRC = path.resolve(process.cwd(), "src")

function jsxFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) jsxFiles(full, out)
    else if (entry.endsWith(".jsx")) out.push(full)
  }
  return out
}

// Comments and string literals out, so prose like "<Date range> written in a
// comment is not mistaken for a component.
function stripNonCode(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/`(?:\\.|[^`\\])*`/g, " ")
    .replace(/'(?:\\.|[^'\\\n])*'/g, " ")
    .replace(/"(?:\\.|[^"\\\n])*"/g, " ")
}

/** Capitalised tag names used in this source, e.g. Foo in an opening tag. */
function tagsUsed(source) {
  const names = new Set()
  for (const [, name] of source.matchAll(/<\/?([A-Z][A-Za-z0-9_]*)/g)) {
    names.add(name)
  }
  return names
}

/**
 * Does the file bind this name anywhere other than in a tag? Strips every
 * opening and closing tag occurrence, then looks for the bare word.
 */
function isBound(source, name) {
  const withoutTags = source.replace(new RegExp(`</?${name}\\b`, "g"), "")
  return new RegExp(`\\b${name}\\b`).test(withoutTags)
}

describe("every JSX component is defined where it is used", () => {
  const files = jsxFiles(SRC)

  it("finds source to check", () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it("has no component used only as a tag and never imported or declared", () => {
    const offenders = []

    for (const file of files) {
      const source = stripNonCode(readFileSync(file, "utf8"))
      for (const name of tagsUsed(source)) {
        if (!isBound(source, name)) {
          offenders.push(`${path.relative(SRC, file)}: <${name}>`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
