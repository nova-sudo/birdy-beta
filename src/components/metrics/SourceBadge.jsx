// components/metrics/SourceBadge.jsx
// The SOURCE pill in the Metrics Hub table.
//
// The glyphs are the handoff's own paths rather than lucide lookalikes — the
// Meta and GoHighLevel marks in particular have no lucide equivalent, and
// mixing one drawn mark with five borrowed ones is what makes a badge row look
// assembled instead of designed.

import { SOURCE_STYLES } from "@/lib/metric-sources"

const GLYPHS = {
  meta: [
    "M6.9 4.3C4.4 4.3 2 8 2 12c0 2.6 1.1 3.8 1.9 3.8 1.8 0 3-2.9 4-5 1-2 1.7-3 2.6-3",
    "M6.9 4.3c2.5 0 4.2 4 5.1 6.5.9-2.5 2.6-6.5 5.1-6.5 2.5 0 4.9 3.7 4.9 7.7 0 2.6-1.1 3.8-1.9 3.8-1.8 0-3-2.9-4-5-1-2-1.7-3-2.6-3",
  ],
  ghl: ["M4 16l4-6 4 4 4-8 4 6"],
  // HotProspector's own mark is a flame, so the badge draws one instead of the
  // dollar sign it carried while the pill just said "Sales". Drawn in
  // currentColor like its neighbours rather than dropping in the blue PNG
  // logo, which would fight the orange pill it sits in.
  sales: [
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  ],
  birdy: ["M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17l-1.9-5.1L4.5 10l5.6-1.4z"],
  tag: [
    "M20.6 12.6L13.4 19.8a2 2 0 0 1-2.8 0L3.5 12.7a2 2 0 0 1-.6-1.4V5.5a2 2 0 0 1 2-2h5.8a2 2 0 0 1 1.4.6l7.5 7.5a2 2 0 0 1 0 2.8z",
    "M7.5 7.5h.01",
  ],
  custom: ["M9 3H7a2 2 0 0 0-2 2v3.5L3 12l2 3.5V19a2 2 0 0 0 2 2h2", "M8 8h6", "M9 12h.01", "M12 12h.01", "M15 12h.01"],
}

export function SourceBadge({ source }) {
  const style = SOURCE_STYLES[source] || SOURCE_STYLES.birdy
  const paths = GLYPHS[source] || GLYPHS.birdy

  return (
    <span
      className="inline-flex items-center gap-[6px] rounded-full border px-[11px] py-[4px] text-[12px] font-semibold"
      style={{ color: style.color, background: style.bg, borderColor: style.border }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
      {style.label}
    </span>
  )
}
