/**
 * Turns the LaTeX math the model sometimes writes into plain text.
 *
 * Birdy's replies are markdown, and markdown treats `\(` as an escaped `(`, so
 * `\( \frac{17}{232} \times 100 \approx 7.33\% \)` rendered as
 * "( \frac{17}{232} \times 100 \approx 7.33% )": the formula, not the
 * answer. We don't ship a math renderer; the answers only ever need
 * arithmetic, so the math is rewritten as plain text and, when it ends in a
 * result, cut down to that result: `7.33%`.
 *
 * Only delimited math is touched: `\( \)`, `\[ \]` and `$$ $$`. Single `$` is
 * left alone because replies are full of currency. Code spans and fences are
 * left alone too.
 */

const SYMBOLS = {
  times: "×",
  cdot: "·",
  div: "÷",
  approx: "≈",
  pm: "±",
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  ne: "≠",
  neq: "≠",
  to: "→",
  rightarrow: "→",
  Rightarrow: "⇒",
  infty: "∞",
  Delta: "Δ",
}

// Commands that only wrap their argument: \text{won} → won.
const WRAPPERS = /\\(?:text|textbf|textit|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g
// Innermost fraction first, so nested ones unwrap on later passes.
const FRAC = /\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g

function mathToText(src) {
  let s = src
  for (let i = 0; i < 10; i++) {
    const next = s
      .replace(WRAPPERS, "$1")
      .replace(FRAC, (_, num, den) => `${group(num)} / ${group(den)}`)
    if (next === s) break
    s = next
  }
  return s
    .replace(/\\left|\\right/g, "")
    .replace(/\\([%$&#_])/g, "$1")
    .replace(/\\[,;:! ]/g, " ")
    .replace(/\\([A-Za-z]+)/g, (m, name) => SYMBOLS[name] ?? m)
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

// The reader wants the number, not the working: `17 / 232 × 100 ≈ 7.33%`
// becomes `7.33%`. Math with no result in it is kept as written.
function resultOnly(text) {
  const parts = text.split(/[=≈]/)
  const last = parts[parts.length - 1].trim()
  return parts.length > 1 && last ? last : text
}

// A compound numerator or denominator keeps its meaning only in parentheses.
function group(part) {
  const t = part.trim()
  return /^[\w.,%]+$/.test(t) ? t : `(${t})`
}

const MATH = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$/g
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/

export function delatex(text) {
  if (!text || typeof text !== "string" || !/\\[([]|\$\$/.test(text)) return text
  return text
    .split(CODE)
    .map((part, i) =>
      i % 2 === 1 ? part : part.replace(MATH, (_, a, b, c) => resultOnly(mathToText(a ?? b ?? c))),
    )
    .join("")
}
