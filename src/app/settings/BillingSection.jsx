import { CreditsPanel } from "@/components/settings/CreditsPanel"
import { PlanPicker } from "@/components/billing/PlanPicker"

// Settings → Billing: credits panel, then the plan picker with the portal,
// cancel and reactivate handlers.
export function BillingSection({
  billingStatus,
  loadingPortal,
  subscriptionBusy,
  handlePortal,
  handleCancelSubscription,
  handleReactivateSubscription,
}) {
  return (
    <>
      {/* Credits, packs and the 30-day usage chart the design asks for.
          The same panel the standalone /credits page renders, so the two
          cannot drift — the heading is the tab's own because /credits
          already carries one of its own above the panel. */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">Birdy Credits</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your AI usage this billing period. A credit is about one cent of AI work — a
          typical Ask Birdy question costs a handful.
        </p>
      </div>

      <CreditsPanel />

      <hr className="border-border" />

      {/* ── Your plan ──
          The three tiers as /billing draws them, with the status, the
          renewal date and the portal link the old current-plan bar
          carried folded in underneath. */}
      <PlanPicker
        billingStatus={billingStatus}
        onManage={handlePortal}
        loadingManage={loadingPortal}
        onCancel={handleCancelSubscription}
        onReactivate={handleReactivateSubscription}
        busySubscription={subscriptionBusy}
      />
    </>
  )
}
