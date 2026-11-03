"use client"

import { scoreTone } from "@/lib/creative-verdict"

const DOT = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  muted: "bg-subdued",
  neutral: "bg-neutral",
}

const POSTED = new Set(["created", "active"])
const IN_FLIGHT = new Set(["pending", "uploading"])

function dotTone(ad) {
  if (ad.post_state === "failed") return "danger"
  if (IN_FLIGHT.has(ad.post_state)) return "neutral"
  return scoreTone(ad.score?.state)
}

/** One 10px square per ad account, then "7/9 pass" (or "3 posted · 2 failed" while posting). */
export function AccountDotStrip({ ads = [] }) {
  const failed = ads.filter((a) => a.post_state === "failed").length
  const posting = failed > 0 || ads.some((a) => IN_FLIGHT.has(a.post_state))
  const posted = ads.filter((a) => POSTED.has(a.post_state)).length
  const pass = ads.filter((a) => a.score?.state === "pass").length
  const text = posting ? `${posted} posted · ${failed} failed` : `${pass}/${ads.length} pass`
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5" aria-hidden>
        {ads.map((ad, i) => (
          <i key={ad.id ?? i} className={`size-2.5 rounded-[2px] ${DOT[dotTone(ad)] ?? DOT.muted}`} />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">{text}</span>
    </div>
  )
}
