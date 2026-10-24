import { CreditsPanel } from "@/components/settings/CreditsPanel"
import { PlanPicker } from "@/components/billing/PlanPicker"
import { Separator } from "@/components/ui/separator"
import { Stagger, StaggerItem } from "@/components/motion"

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
    <Stagger className="space-y-6">
    {/* Credits, packs and the 30-day usage chart the design asks for.
        The same panel the standalone /credits page renders, so the two
        cannot drift — the heading is the tab's own because /credits
        already carries one of its own above the panel. */}
    <StaggerItem>
      <h2 className="font-pd-display text-[19px] font-bold tracking-[-0.02em] text-pd-ink">
        Birdy Credits
      </h2>
      <p className="mt-1 text-[13px] text-pd-faint">
        Your AI usage this billing period. A credit is about one cent of AI work — a
        typical Ask Birdy question costs a handful.
      </p>
    </StaggerItem>

    <StaggerItem>
      <CreditsPanel />
    </StaggerItem>

    <Separator />

    {/* ── Your plan ──
        The three tiers as /billing draws them, with the status, the
        renewal date and the portal link the old current-plan bar
        carried folded in underneath. */}
    <StaggerItem>
      <PlanPicker
        billingStatus={billingStatus}
        onManage={handlePortal}
        loadingManage={loadingPortal}
        onCancel={handleCancelSubscription}
        onReactivate={handleReactivateSubscription}
        busySubscription={subscriptionBusy}
      />
    </StaggerItem>
    </Stagger>
  )
}
