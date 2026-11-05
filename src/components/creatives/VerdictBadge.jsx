"use client"

import { Badge } from "@/components/ds"
import { VERDICT_META } from "@/lib/creative-verdict"

/** A creative test's status as a ds Badge (label and tone from VERDICT_META); `detail` follows the label ("7 of 9"). */
export function VerdictBadge({ status, detail }) {
  const meta = VERDICT_META[status] ?? { label: status ?? "—", tone: "muted" }
  return (
    <Badge variant="dot" tone={meta.tone} size="sm" className="whitespace-nowrap">
      {detail ? `${meta.label} · ${detail}` : meta.label}
    </Badge>
  )
}
