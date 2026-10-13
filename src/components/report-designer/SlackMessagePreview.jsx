"use client"

// The Slack report exactly as the renderer builds it (header, body, Birdy's
// take, context), drawn as a Slack message. Blocks come from
// /api/report-designer/preview, so what is shown is what will be posted.

import { Fragment } from "react"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { parseMrkdwn } from "@/lib/report-designer"

function Mrkdwn({ text }) {
  const lines = parseMrkdwn(text)
  return lines.map((segs, i) => (
    <Fragment key={i}>
      {segs.map((s, j) =>
        s.bold ? <strong key={j} className="font-semibold text-white">{s.text}</strong>
          : s.italic ? <em key={j}>{s.text}</em>
            : <Fragment key={j}>{s.text}</Fragment>
      )}
      {i < lines.length - 1 && <br />}
    </Fragment>
  ))
}

export default function SlackMessagePreview({ blocks, time, loading = false }) {
  return (
    <div className="rounded-xl bg-[#1A1D21] px-4 py-[14px] text-left shadow-[0_14px_30px_-16px_rgba(20,14,50,0.55)]">
      <div className="flex gap-[10px]">
        <BirdyAvatar size={34} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-[7px]">
            <span className="text-[13.5px] font-bold text-white">Birdy</span>
            <span className="rounded-[3px] bg-white/10 px-[4px] text-[9.5px] font-semibold uppercase tracking-wide text-white/60">App</span>
            {time && <span className="text-[11px] text-white/50">{time}</span>}
          </div>
          <div className={`mt-1.5 space-y-2.5 transition-opacity duration-300 ${loading ? "opacity-40" : ""}`}>
            {(blocks || []).map((b, i) => {
              if (b.type === "header") {
                return <div key={i} className="text-[15px] font-bold leading-snug text-white">{b.text?.text}</div>
              }
              if (b.type === "section") {
                return (
                  <div key={i} className="text-[13px] leading-[1.6] text-white/85">
                    <Mrkdwn text={b.text?.text} />
                  </div>
                )
              }
              if (b.type === "context") {
                return (
                  <div key={i} className="text-[11px] text-white/45">
                    {(b.elements || []).map((e, j) => <Mrkdwn key={j} text={e.text} />)}
                  </div>
                )
              }
              return null
            })}
            {!blocks?.length && (
              <div className="space-y-2">
                {[70, 92, 84, 60].map((w) => (
                  <div key={w} className="h-3 animate-pulse rounded bg-white/10" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
