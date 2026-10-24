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
import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Frame, FunnelBar, Notice, Surface } from "@/components/ds"
import {
  buildExitSplit,
  buildLandingSteps,
  diagnoseLandingFunnel,
} from "@/lib/landing-funnel"

export function LandingFunnel({ funnel, loading = false, error = null, groupId = null, className }) {
  const steps = useMemo(() => buildLandingSteps(funnel), [funnel])
  const exits = useMemo(() => buildExitSplit(funnel), [funnel])
  const diagnosis = useMemo(() => diagnoseLandingFunnel(funnel), [funnel])

  // On the very first load nothing is drawn at all. Most clients are not
  // landing-page clients, and a skeleton card that appears on every one of
  // their screens and then vanishes is a layout jump announcing a feature they
  // don't have. Once a funnel is in hand, a refresh keeps the card and shows
  // the skeleton inside it.
  if (loading && !funnel?.applicable) return null

  // Not a landing-page client, or the fetch failed. Either way there is
  // nothing truthful to draw, and a card apologising for itself on every
  // Instant Form client's screen is worse than no card.
  if (!loading && (error || !funnel?.applicable || !steps)) return null

  const frame = (children) => (
    <Frame
      data-ds="landing-funnel"
      title="Landing page funnel"
      meta="shares are of landing views"
      className={className}
      actions={
        groupId ? (
          <Link
            href={`/clients/${groupId}/tracking`}
            className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:shadow-control-focus"
          >
            Tracking setup
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null
      }
    >
      {children}
    </Frame>
  )

  if (loading) {
    return frame(
      <Surface>
        <FunnelBar loading steps={steps ?? []} />
      </Surface>
    )
  }

  const installed = funnel.installed
  const empty = !funnel.totals?.views

  return frame(
    <>
      <Surface className="flex flex-col gap-4">
        <FunnelBar steps={steps} />

        {/* Nothing has arrived yet. Which of the two reasons it is matters — a
            snippet that was never installed is a task for someone, a quiet
            window is not — so the card says which rather than drawing zeroes and
            leaving the reader to guess. */}
        {empty && (
          <p className="border-t border-border pt-4 text-sm text-muted-foreground">
            {installed
              ? "No landing page visits in this window. The snippet is live and reporting, so this is a quiet period rather than a broken tag."
              : "We haven't seen a single page view from this client yet — the snippet isn't on their landing page, or it sits behind a cookie banner that blocks it until someone consents."}
          </p>
        )}

        {exits && (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-sm font-semibold text-foreground">Left without opting in</h3>
              <p className="num text-sm text-muted-foreground">
                {exits.totalLabel} visits · {exits.rate}
              </p>
            </div>

            <ul className="grid gap-3 md:grid-cols-2">
              {exits.rows.map((row) => (
                <li key={row.key} className="rounded-control bg-muted p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-body">{row.label}</span>
                    <span className="num text-lg font-medium text-foreground">{row.countLabel}</span>
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-3">
                    {/* The fix each half points at. Two numbers with no reading
                        attached is the thing this card exists to replace. */}
                    <span className="text-xs text-muted-foreground">{row.note}</span>
                    <span className="num shrink-0 text-xs text-muted-foreground">{row.share}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Surface>

      {diagnosis && (
        <Notice tone={diagnosis.state === "problem" ? "danger" : "success"} title={diagnosis.title}>
          {diagnosis.body}
        </Notice>
      )}
    </>
  )
}

export default LandingFunnel
