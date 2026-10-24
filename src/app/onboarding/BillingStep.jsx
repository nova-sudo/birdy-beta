"use client"

// Onboarding step 19 (mandatory, no skip): the reader must have an active
// Whop subscription before the bulk sub-account import — the actual client-
// data load — is allowed to run. Reuses the same plan list, plan cards and
// embedded checkout /billing sells from (@/components/billing,
// @whop/checkout/react).

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge, Button, Notice, Skeleton, Spinner, Surface } from "@/components/ds"
import { WhopCheckoutEmbed } from "@whop/checkout/react"
import { apiRequest } from "@/lib/api"
import { PLANS } from "@/components/billing/plans"
import { PlanCard } from "@/components/billing/PlanCard"
import { Stagger, StaggerItem } from "@/components/motion"
import { FakeProgressBar, STEP_COL_WIDE, StepHeading, SuccessRow } from "./parts"

const WHOP_ENVIRONMENT =
  (process.env.NEXT_PUBLIC_WHOP_ENVIRONMENT ?? "production") === "sandbox"
    ? "sandbox"
    : "production"

function getStoredEmail() {
  if (typeof window === "undefined") return ""
  try {
    return JSON.parse(localStorage.getItem("user"))?.email ?? ""
  } catch {
    return ""
  }
}

export default function BillingStep({ accountCount, onSubscribed, importing }) {
  // checking -> picking -> checkout -> activating
  const [phase, setPhase] = useState("checking")
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [error, setError] = useState(null)
  const [email] = useState(getStoredEmail)

  // Cheapest plan that fits the number of sub-accounts about to be
  // imported — ReviewStep caps selection at 25 (Scale's own max), so this
  // always resolves to a real plan rather than falling off the end.
  const recommendedPlanId = useMemo(() => {
    const fit = PLANS.find((p) => accountCount <= p.maxClients)
    return (fit || PLANS[PLANS.length - 1]).id
  }, [accountCount])

  const checkStatus = useCallback(async () => {
    try {
      const res = await apiRequest("/api/billing/status")
      if (!res.ok) return false
      const status = await res.json()
      return Boolean(status?.subscribed)
    } catch {
      return false
    }
  }, [])

  // A returning user (re-run of the wizard, or a webhook that landed while
  // they were still on the review step) may already be subscribed — skip
  // straight past the plan picker rather than asking them to pay twice.
  useEffect(() => {
    let cancelled = false
    checkStatus().then((subscribed) => {
      if (cancelled) return
      if (subscribed) onSubscribed()
      else setPhase("picking")
    })
    return () => { cancelled = true }
  }, [checkStatus, onSubscribed])

  // Whop confirms the purchase to the backend via webhook, which flips the
  // subscription live — poll a few times so this step catches up, same
  // cadence /billing's pollAfterCheckout uses.
  const pollUntilSubscribed = useCallback(() => {
    setPhase("activating")
    const delays = [1500, 3000, 5000, 8000, 12000]
    let i = 0
    const tick = async () => {
      const subscribed = await checkStatus()
      if (subscribed) {
        onSubscribed()
        return
      }
      if (i < delays.length) {
        setTimeout(tick, delays[i])
        i += 1
      } else {
        setError("Still waiting on your subscription to activate — hang tight, this can take a minute.")
        setTimeout(tick, 5000)
      }
    }
    setTimeout(tick, delays[i])
    i += 1
  }, [checkStatus, onSubscribed])

  if (phase === "checking") {
    return (
      <div className={`${STEP_COL_WIDE} flex flex-col gap-3 py-16`}>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mb-3 h-4 w-1/2" />
        <div className="grid w-full grid-cols-1 gap-3.5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[150px] w-full" />)}
        </div>
      </div>
    )
  }

  if (phase === "activating" || importing) {
    return (
      <div className={STEP_COL_WIDE}>
        <SuccessRow>Payment received</SuccessRow>
        <StepHeading>Activating your subscription…</StepHeading>
        {/* Two different waits wearing one screen. Whop's activation is
            seconds; the import inserts a client group per sub-account and can
            run well past a minute on a full 25. Both are long enough that a
            lone spinner reads as a hang, and this is the one screen nobody can
            afford to reload — they have already paid. */}
        <div className="mb-5 flex"><Spinner size={22} className="text-primary" /></div>
        <FakeProgressBar
          className="mb-3.5"
          expectedMs={importing ? Math.max(8000, accountCount * 1200) : 4000}
        />
        <div className="text-center text-sm text-muted-foreground">
          {importing
            ? `Bringing in your ${accountCount} sub-account${accountCount === 1 ? "" : "s"}…`
            : "This usually takes a few seconds — safe to leave this open, it'll pick up automatically."}
        </div>
        {error && <div className="mt-4 text-center text-xs text-muted-foreground">{error}</div>}
      </div>
    )
  }

  return (
    // Heading and copy lead the plan tiles in by a beat; the tiles and the
    // checkout that replaces them come in with the step itself.
    <Stagger className={STEP_COL_WIDE} gap={0.06}>
      <StaggerItem>
        <StepHeading
          description={`You're about to import ${accountCount} sub-account${accountCount === 1 ? "" : "s"} — an active plan is required before Birdy loads their data.`}
        >
          One more thing — pick a plan to bring in your sub-accounts
        </StepHeading>
      </StaggerItem>

      {!selectedPlan ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div key={plan.id} className="flex flex-col gap-2">
                {/* Reserved on every column so the three cards stay level. */}
                <div className="h-5">
                  {plan.id === recommendedPlanId && <Badge tone="primary">Recommended for you</Badge>}
                </div>
                <PlanCard
                  plan={plan}
                  billingStatus={null}
                  // A plan with no Whop id yet cannot be bought; one badge per card.
                  disabled={!plan.planId}
                  hideBadge={plan.id === recommendedPlanId}
                  onCheckout={(picked) => picked.planId && setSelectedPlan(picked)}
                />
              </div>
            ))}
          </div>
          {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
        </>
      ) : (
        <div className="max-w-[440px]">
          <SuccessRow>{selectedPlan.name} selected — ${selectedPlan.price}/mo</SuccessRow>
          <Surface padded={false} className="p-3">
            <WhopCheckoutEmbed
              planId={selectedPlan.planId}
              environment={WHOP_ENVIRONMENT}
              theme="light"
              skipRedirect
              // Some payment methods (3DS, buy-now-pay-later) leave the page
              // entirely regardless of skipRedirect — without an explicit
              // returnUrl, Whop has nowhere of ours to send the browser back
              // to. The wizard's own persisted step + pending_import (not
              // this component's local state) is what actually recovers on
              // that reload — see handleReviewContinue/boot() in page.jsx.
              returnUrl={typeof window !== "undefined" ? `${window.location.origin}/onboarding` : undefined}
              prefill={email ? { email } : undefined}
              onComplete={pollUntilSubscribed}
              fallback={
                <div className="flex flex-col gap-3 py-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-11 w-full" />
                </div>
              }
            />
          </Surface>
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedPlan(null)} className="text-muted-foreground">
              Choose a different plan
            </Button>
          </div>
        </div>
      )}
    </Stagger>
  )
}
