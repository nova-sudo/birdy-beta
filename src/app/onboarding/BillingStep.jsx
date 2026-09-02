"use client"

// Onboarding step 19 (mandatory, no skip): the reader must have an active
// Whop subscription before the bulk sub-account import — the actual client-
// data load — is allowed to run. Reuses the same plan list and embedded
// checkout /billing sells from (@/components/billing/plans,
// @whop/checkout/react), styled with the wizard's own pd-* look instead of
// that page's Tailwind-gray cards.

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { WhopCheckoutEmbed } from "@whop/checkout/react"
import { apiRequest } from "@/lib/api"
import { PLANS } from "@/components/billing/plans"
import { SpinnerRing, StepHeading, SuccessRow } from "./parts"

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
      <div className="flex flex-col items-center gap-3 py-16">
        <SpinnerRing size={22} />
      </div>
    )
  }

  if (phase === "activating" || importing) {
    return (
      <div className="w-full max-w-[440px] text-center">
        <SuccessRow>Payment received</SuccessRow>
        <div className="mb-3"><StepHeading small>Activating your subscription…</StepHeading></div>
        <div className="mb-[26px] flex justify-center"><SpinnerRing size={22} /></div>
        <div className="text-[13px] text-pd-faint">
          {importing
            ? `Bringing in your ${accountCount} sub-account${accountCount === 1 ? "" : "s"}…`
            : "This usually takes a few seconds — safe to leave this open, it'll pick up automatically."}
        </div>
        {error && <div className="mt-4 text-[12.5px] text-pd-faint">{error}</div>}
      </div>
    )
  }

  return (
    <div className="w-full max-w-[780px] text-left">
      <div className="mb-2 text-center">
        <StepHeading small>One more thing — pick a plan to bring in your sub-accounts</StepHeading>
      </div>
      <div className="mb-[22px] text-center text-[13.5px] text-pd-faint">
        You&apos;re about to import {accountCount} sub-account{accountCount === 1 ? "" : "s"} — an active
        plan is required before Birdy loads their data.
      </div>

      {!selectedPlan ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-[14px] sm:grid-cols-3">
            {PLANS.map((plan) => {
              const Icon = plan.icon
              return (
                <div
                  key={plan.id}
                  onClick={() => plan.planId && setSelectedPlan(plan)}
                  className={`cursor-pointer rounded-[14px] border-2 px-5 py-[22px] text-center transition-colors ${
                    plan.planId ? "" : "cursor-not-allowed opacity-50"
                  }`}
                  style={{ borderColor: "#ECECF2", background: "#fff" }}
                >
                  <div className="mx-auto mb-3 flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-pd-primary-tint text-pd-primary">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  </div>
                  <div className="mb-1 font-pd-display text-[15px] font-semibold text-pd-ink">{plan.name}</div>
                  <div className="mb-2 font-pd-display text-[22px] font-bold text-pd-ink">
                    ${plan.price}<span className="text-[12px] font-medium text-pd-faint">/mo</span>
                  </div>
                  <div className="text-[11.5px] text-pd-faint">Up to {plan.maxClients} clients</div>
                </div>
              )
            })}
          </div>
          {error && (
            <div className="mb-4 rounded-xl border border-pd-danger-border bg-pd-danger-bg px-4 py-3 text-center text-[12.5px] text-pd-body">
              {error}
            </div>
          )}
        </>
      ) : (
        <div className="mx-auto max-w-[440px]">
          <div className="mb-4 text-center">
            <SuccessRow>{selectedPlan.name} selected — ${selectedPlan.price}/mo</SuccessRow>
          </div>
          <div className="rounded-xl border border-pd-border p-3">
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
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-pd-faint" />
                </div>
              }
            />
          </div>
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setSelectedPlan(null)}
              className="cursor-pointer text-[12.5px] font-semibold text-pd-faint hover:text-pd-body"
            >
              Choose a different plan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
