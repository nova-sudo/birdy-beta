// lib/page-numbers.js
// Which page buttons to draw between Previous and Next.
//
// The design shows first · current · ellipsis · last — enough to jump to
// either end without a strip of 20 buttons. Its own sketch assumes 20 pages
// and duplicates numbers below that, so this adds the collapsing the real
// catalog needs: 26 metrics at 15 a page is two pages, and "1 2 ··· 2" is not
// a pager.

/**
 * @param {number} current 1-based.
 * @param {number} total Total pages.
 * @returns {Array<number|"ellipsis">} Ready to render in order.
 */
export function pageNumbers(current, total) {
  if (total <= 1) return total === 1 ? [1] : []
  // Up to five fits without eliding; showing them all is easier to aim at.
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)

  const shown = new Set([1, current, total])
  // At either end the set would collapse to two numbers with an ellipsis
  // between them, so the pager offers no one-click step. Keep the neighbour,
  // which is what the design draws on page 1.
  if (current <= 2) shown.add(2)
  if (current >= total - 1) shown.add(total - 1)

  const sorted = [...shown].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)

  const out = []
  sorted.forEach((n, i) => {
    // A gap of exactly one page prints that page instead of an ellipsis —
    // "1 ··· 3" hides a single number behind a wider control.
    if (i > 0) {
      const gap = n - sorted[i - 1]
      if (gap === 2) out.push(n - 1)
      else if (gap > 2) out.push("ellipsis")
    }
    out.push(n)
  })
  return out
}
