"use client"

// components/attribution/LandingFunnel.jsx
// The landing-page funnel card, drawn wherever one client is in view — the
// Marketing Hub with a client selected, and the client workspace's Overview.
//
// It only exists for clients whose ads point at a page of their own with our
// snippet on it. The endpoint decides that, not this component: a client on
// Meta Instant Forms gets `applicable: false` and the card renders nothing at
// all, because four zeroes under "Landing page" read as a page that is failing
// rather than one that was never there.
//
// The stages are the top half. The half underneath is the point: everyone who
// didn't opt in, split by whether they ever touched the form. See
// lib/landing-funnel.js for why that split is the whole reason the tracker
// reports a form start.

import { useMemo } from "react"
import { ArrowRight, TrendingDown } from "lucide-react"
import Link from "next/link"

import { DiagnosticBanner, FunnelStepper, PdCard } from "@/components/portfolio"
import { Skeleton } from "@/components/ui/skeleton"
import { pdFontClass } from "@/lib/pd-fonts"
import {
  buildExitSplit,
  buildLandingStages,
  diagnoseLandingFunnel,
} from "@/lib/landing-funnel"

// The card carries the handoff's fonts itself rather than being wrapped in
// them by each caller. A wrapper would still be in the flow on the screens
// where this renders nothing, and an empty div inside a `gap-6` column is a
// 24px hole on every client who has no landing page.
function Frame({ children, action }) {
  return (
    <PdCard title="Landing page funnel" action={action} className={pdFontClass}>
      {children}
    </PdCard>
  )
}

export function LandingFunnel({ funnel, loading = false, error = null, groupId = null }) {
  const stages = useMemo(() => buildLandingStages(funnel), [funnel])
  const exits = useMemo(() => buildExitSplit(funnel), [funnel])
  const diagnosis = useMemo(() => diagnoseLandingFunnel(funnel), [funnel])

  // On the very first load nothing is drawn at all. Most clients are not
  // landing-page clients, and a skeleton card that appears on every one of
  // their screens and then vanishes is a layout jump announcing a feature they
  // don't have. Once a funnel is in hand, a refresh keeps the card and shows
  // the skeleton inside it.
  if (loading && !funnel?.applicable) return null

  if (loading) {
    return (
      <Frame>
        <div className="flex items-start gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-1 space-y-2">
              <Skeleton className="mx-auto size-[42px] rounded-xl" />
              <Skeleton className="mx-auto h-3 w-20" />
              <Skeleton className="mx-auto h-5 w-14" />
            </div>
          ))}
        </div>
      </Frame>
    )
  }

  // Not a landing-page client, or the fetch failed. Either way there is
  // nothing truthful to draw, and a card apologising for itself on every
  // Instant Form client's screen is worse than no card.
  if (error || !funnel?.applicable || !stages) return null

  const installed = funnel.installed
  const empty = !funnel.totals?.views

  return (
    <Frame
      action={
        groupId ? (
          <Link
            href={`/clients/${groupId}/tracking`}
            className="flex items-center gap-1 text-[12.5px] font-semibold text-pd-primary hover:underline"
          >
            Tracking setup
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null
      }
    >
      <FunnelStepper stages={stages} shareOf="landing views" />

      {/* Nothing has arrived yet. Which of the two reasons it is matters — a
          snippet that was never installed is a task for someone, a quiet
          window is not — so the card says which rather than drawing zeroes and
          leaving the reader to guess. */}
      {empty && (
        <p className="mt-4 border-t border-pd-border pt-4 text-[12.5px] leading-[1.5] text-pd-faint">
          {installed
            ? "No landing page visits in this window. The snippet is live and reporting, so this is a quiet period rather than a broken tag."
            : "We haven't seen a single page view from this client yet — the snippet isn't on their landing page, or it sits behind a cookie banner that blocks it until someone consents."}
        </p>
      )}

      {exits && (
        <div className="mt-[18px] border-t border-pd-border pt-4">
          <div className="mb-3 flex items-baseline gap-2">
            <TrendingDown className="size-4 shrink-0 self-center text-pd-subtle" aria-hidden="true" />
            <p className="font-pd-display text-[13px] font-semibold text-pd-ink">
              Left without opting in
            </p>
            <p className="text-[12.5px] text-pd-faint">
              {exits.totalLabel} visits · {exits.rate}
            </p>
          </div>

          <ul className="grid gap-[10px] md:grid-cols-2">
            {exits.rows.map((row) => (
              <li
                key={row.key}
                className="rounded-[12px] border border-pd-border bg-pd-canvas px-[14px] py-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] text-pd-body">{row.label}</span>
                  <span className="font-pd-display text-[17px] font-bold text-pd-ink">
                    {row.countLabel}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3">
                  {/* The fix each half points at. Two numbers with no reading
                      attached is the thing this card exists to replace. */}
                  <span className="text-[11.5px] leading-[1.45] text-pd-faint">{row.note}</span>
                  <span className="shrink-0 text-[11.5px] text-pd-faint">{row.share}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnosis && (
        <DiagnosticBanner
          state={diagnosis.state}
          title={diagnosis.title}
          body={diagnosis.body}
          className="mt-[14px]"
        />
      )}
    </Frame>
  )
}

export default LandingFunnel
