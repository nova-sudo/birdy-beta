// components/metrics/SourceBadge.jsx
// The SOURCE pill in the Metrics Hub table.
//
// The marks are the product logos the rest of the app already ships from
// @/lib/icons — the Meta infinity, the GoHighLevel arrows, the HotProspector
// flame, the flask for custom formulas. The handoff drew currentColor
// lookalikes because the design file had no access to the assets; a row of
// real logos is what makes the source scannable at a glance, and it keeps this
// badge consistent with the column headers and the metric picker, which have
// always used these same files.
//
// Birdy is the exception: it has no third-party logo, so it keeps the drawn
// star in the pill's own purple.

import Image from "next/image"

import { ghlIcon, metaIcon, hpIcon, flaskIcon } from "@/lib/icons"
import { SOURCE_STYLES } from "@/lib/metric-sources"

// Tags are a GoHighLevel concept — the tag counts are read off GHL contacts —
// so the tag pill carries the GHL mark rather than a generic label icon.
const LOGOS = {
  meta: metaIcon,
  ghl: ghlIcon,
  sales: hpIcon,
  tag: ghlIcon,
  custom: flaskIcon,
}

const BIRDY_STAR = "M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17l-1.9-5.1L4.5 10l5.6-1.4z"

export function SourceBadge({ source }) {
  const style = SOURCE_STYLES[source] || SOURCE_STYLES.birdy
  const logo = LOGOS[source]

  return (
    <span
      className="inline-flex items-center gap-[6px] rounded-full border px-[11px] py-[4px] text-[12px] font-semibold"
      style={{ color: style.color, background: style.bg, borderColor: style.border }}
    >
      {logo ? (
        <Image src={logo} alt="" width={13} height={13} className="size-[13px] shrink-0 object-contain" />
      ) : (
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
          <path d={BIRDY_STAR} />
        </svg>
      )}
      {style.label}
    </span>
  )
}
