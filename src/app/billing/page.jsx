"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Check, Plus, ExternalLink, AlertCircle, Loader2, Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageHeader } from "@/components/page-header";
import { pdFontClass } from "@/lib/pd-fonts";
import { Stagger, StaggerItem, EASE_OUT } from "@/components/motion";
import { cn } from "@/lib/utils";
import {
  useCreditsData, CreditBalanceCard, TopupPacksCard, CreditUsageCard, TopupModal, SuccessBanner,
} from "@/components/settings/CreditsPanel";

// Whop plan IDs (plan_XXXXXXXX) are created in the Whop dashboard
// (Checkout Links → Details) and injected via env. Set the environment to
// "sandbox" to run Whop's test mode, "production" for live charges.
const WHOP_ENVIRONMENT =
  (process.env.NEXT_PUBLIC_WHOP_ENVIRONMENT ?? "production") === "sandbox"
    ? "sandbox"
    : "production";
// Optional: a separate recurring "extra client slot" plan (Scale add-on).
const EXTRA_CLIENT_PLAN_ID = process.env.NEXT_PUBLIC_WHOP_PLAN_EXTRA_CLIENT ?? "";
const EXTRA_CLIENT_PRICE = 10;

// Tiers, order and palette are shared with the Settings Billing tab, which
// shows the same three plans.
import { PLANS, PLAN_ORDER, STATUS_LABELS, STATUS_STYLES } from "@/components/billing/plans";
import { PlanCard } from "@/components/billing/PlanCard";

// Best-effort read of the signed-in user's email so we can prefill the Whop
// checkout form. In this app the account id (user_id) *is* the email, so this
// is also what the backend webhook uses to reconcile the purchase.
function getStoredEmail() {
  if (typeof window === "undefined") return "";
  try {
    return JSON.parse(localStorage.getItem("user"))?.email ?? "";
  } catch {
    return "";
  }
}

// Modal that mounts the Whop embedded checkout for the selected plan.
function CheckoutModal({ plan, email, onClose, onComplete }) {
  const [appliedPromo, setAppliedPromo] = useState(null);
  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/billing?checkout=success`
      : undefined;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 py-4 border-b border-pd-border text-left">
          <DialogTitle className="font-pd-display text-[18px]">Subscribe to {plan.name}</DialogTitle>
          <DialogDescription>
            ${plan.price}/mo · Secure checkout powered by Whop
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {appliedPromo && (
            <div className="mb-3 flex items-center gap-2 rounded-2xl bg-pd-success-bg px-3 py-2 text-sm text-pd-success">
              <Check className="w-4 h-4 shrink-0" />
              <span>
                <span className="font-semibold">{appliedPromo.code}</span> applied —{" "}
                {appliedPromo.type === "percentage"
                  ? `${appliedPromo.amount}% off`
                  : `$${appliedPromo.amount} off`}
              </span>
            </div>
          )}
          <WhopCheckoutEmbed
            planId={plan.planId}
            environment={WHOP_ENVIRONMENT}
            theme="light"
            skipRedirect
            returnUrl={returnUrl}
            prefill={email ? { email } : undefined}
            onComplete={onComplete}
            onPromoCodeChanged={setAppliedPromo}
            fallback={
              <div className="space-y-3 py-2">
                <Skeleton className="h-10 w-full rounded-full" />
                <Skeleton className="h-10 w-full rounded-full" />
                <Skeleton className="h-12 w-full rounded-full" />
              </div>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-bold", STATUS_STYLES[status] ?? STATUS_STYLES.inactive)}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** What you're on, how much of it you use, and the ways to change it. */
function PlanSummaryCard({ billingStatus, onPortal, loadingPortal, onUpgrade, onAddExtraSlots }) {
  const plan = billingStatus?.subscribed ? PLANS.find((p) => p.id === billingStatus.plan?.id) : null;

  if (!plan) {
    return (
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-pd-border bg-pd-surface p-5 shadow-sm">
        <div>
          <span className="text-[12.5px] font-medium text-pd-subtle">Your plan</span>
          <div className="mt-1 font-pd-display text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-pd-ink">No plan yet</div>
          <p className="mt-1 text-[13px] text-pd-subtle">Pick a plan below to connect your clients.</p>
        </div>
      </div>
    );
  }

  const limit = Math.max(billingStatus.client_limit ?? plan.maxClients, 1);
  const used = billingStatus.client_count ?? 0;
  const usagePct = Math.min(100, (used / limit) * 100);
  const next = PLANS[PLAN_ORDER.indexOf(plan.id) + 1];
  const canBuyExtraSlots = plan.supportsExtraSlots && !!EXTRA_CLIENT_PLAN_ID;

  return (
    <div className="flex flex-col rounded-xl border border-pd-border bg-pd-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-pd-subtle">Your plan</span>
        <StatusBadge status={billingStatus.status} />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-pd-display text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-pd-ink">{plan.name}</span>
        <span className="text-[14px] font-medium text-pd-subtle">${plan.price}/mo</span>
      </div>
      {billingStatus.current_period_end && (
        <p className="text-[12.5px] text-pd-subtle">
          {billingStatus.cancel_at_period_end ? "Cancels" : "Renews"}{" "}
          {new Date(billingStatus.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between text-[12.5px] text-pd-subtle">
          <span className="flex items-center gap-1.5"><Users className="size-3.5" /> Client groups</span>
          <span className="font-semibold text-pd-ink">
            {used} of {limit}
            {billingStatus.extra_clients_paid > 0 && (
              <span className="ml-1 font-medium text-pd-success">(+{billingStatus.extra_clients_paid} extra)</span>
            )}
          </span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-pd-divider">
          <motion.div
            className={cn("h-full rounded-full", usagePct >= 90 ? "bg-pd-danger" : "bg-pd-primary")}
            initial={{ width: 0 }}
            animate={{ width: `${usagePct}%` }}
            transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.2 }}
          />
        </div>
      </div>

      {billingStatus.cancel_at_period_end && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-pd-warning-bg px-3 py-2 text-[12.5px] text-pd-amber">
          <AlertCircle className="size-4 shrink-0" />
          Your subscription will cancel at the end of this billing period.
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {next && (
          <Button onClick={() => onUpgrade(next)} disabled={loadingPortal}>Upgrade to {next.name}</Button>
        )}
        {canBuyExtraSlots && (
          <Button onClick={onAddExtraSlots} className="gap-1.5">
            <Plus className="size-4" /> Extra client slot (+${EXTRA_CLIENT_PRICE}/mo)
          </Button>
        )}
        <Button variant="outline" onClick={onPortal} disabled={loadingPortal} className="gap-1.5">
          {loadingPortal ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
          Manage billing
        </Button>
      </div>
    </div>
  );
}

const FAQ = [
  { q: "Can I change plans at any time?", a: "Yes. Open Manage billing to switch plans in the Whop customer portal — upgrades are prorated immediately and downgrades take effect at the end of your current billing period." },
  { q: "What counts as a client group?", a: "Each connected client (with a GHL location, Meta ad account, or HotProspector group) counts as one client group toward your limit." },
  { q: "What are extra client slots?", a: "Scale plan users can purchase additional client slots for $10/mo each, beyond the included 25. Starter and Growth plans must upgrade to add more clients." },
  { q: "What are AI credits?", a: "A credit is about one cent of AI work — a typical Ask Birdy question costs a handful. Top-up packs add to your balance when you need more." },
  { q: "How do I cancel?", a: "Click Manage billing to open the Whop customer portal, where you can cancel at any time. You'll keep access until the end of your billing period." },
];

function Faq() {
  return (
    <div className="overflow-hidden rounded-xl border border-pd-border bg-pd-surface shadow-sm">
      {FAQ.map(({ q, a }, i) => (
        <details key={q} open={i === 0} className="group border-t border-pd-divider px-5 py-4 first:border-t-0">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] font-semibold text-pd-ink [&::-webkit-details-marker]:hidden">
            {q}
            <Plus className="size-4 shrink-0 text-pd-subtle transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-open:rotate-45" />
          </summary>
          <p className="mt-2 max-w-[75ch] text-[13.5px] leading-relaxed text-pd-body">{a}</p>
        </details>
      ))}
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[230px] w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-6 w-40" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[280px] w-full rounded-xl" />)}
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [billingStatus, setBillingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [storedEmail] = useState(getStoredEmail);
  const credits = useCreditsData();

  const header = useMemo(
    () => ({
      title: (
        <div className={`${pdFontClass} min-w-0`}>
          <h1 className="truncate font-pd-display text-[19px] font-bold leading-none tracking-[-0.02em] text-pd-ink">Billing</h1>
          <p className="mt-1 truncate text-[12px] leading-none text-pd-faint">Your plan, client slots and AI credits</p>
        </div>
      ),
    }),
    []
  );
  usePageHeader(header);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiRequest("/api/billing/status");
      if (!res.ok) throw new Error("Failed to load billing status");
      setBillingStatus(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Whop confirms the purchase to the backend via webhook, which then flips
  // the subscription live. Poll a few times so the UI catches up.
  const pollAfterCheckout = useCallback(() => {
    setSuccessMsg("Subscription activated! Your plan is now live.");
    setTimeout(() => void fetchStatus(), 2000);
    setTimeout(() => void fetchStatus(), 5000);
    setTimeout(() => void fetchStatus(), 9000);
  }, [fetchStatus]);

  useEffect(() => {
    void fetchStatus();
    const params = new URLSearchParams(window.location.search);
    // Fallback path: Whop may redirect back here (returnUrl) for payment
    // methods that leave the page (3DS, buy-now-pay-later, etc.).
    if (params.get("checkout") === "success") {
      window.history.replaceState({}, "", window.location.pathname);
      pollAfterCheckout();
    }
  }, [fetchStatus, pollAfterCheckout]);

  const handleCheckout = (plan) => {
    setError(null);
    if (!plan.planId) {
      setError(`The ${plan.name} plan isn't available yet — its Whop plan ID hasn't been configured.`);
      return;
    }
    setCheckoutPlan(plan);
  };

  const handleWhopComplete = useCallback(() => {
    // Activation itself happens via the webhook.
    setCheckoutPlan(null);
    void fetchStatus();
    pollAfterCheckout();
  }, [fetchStatus, pollAfterCheckout]);

  // Extra client slots are a separate Whop plan (Scale add-on) purchased
  // through the same embedded checkout.
  const handleAddExtraSlots = () => {
    setError(null);
    if (!EXTRA_CLIENT_PLAN_ID) {
      setError("Extra client slots aren't configured yet.");
      return;
    }
    setCheckoutPlan({ id: "extra_client", name: "Extra Client Slot", price: EXTRA_CLIENT_PRICE, planId: EXTRA_CLIENT_PLAN_ID });
  };

  // Plan changes and cancellations are handled in Whop's hosted customer
  // portal — Whop has no in-place plan-swap API — so "Upgrade"/"Downgrade"
  // and "Manage billing" all open the membership's manage URL.
  const handlePortal = async () => {
    setLoadingPortal(true);
    setError(null);
    try {
      const res = await apiRequest("/api/billing/portal-url");
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to open billing portal");
      if (data.portal_url) window.open(data.portal_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleUpgrade = (plan) => (billingStatus?.subscribed ? handlePortal() : handleCheckout(plan));

  return (
    <div className={`${pdFontClass} mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10`}>
      <SuccessBanner message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      <SuccessBanner message={credits.successMsg} onDismiss={() => credits.setSuccessMsg(null)} />
      {error && (
        <div className="flex items-center gap-3 rounded-2xl bg-pd-danger px-4 py-3 text-white shadow-sm">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
          <button type="button" onClick={() => setError(null)} className="ml-auto rounded-full px-2 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Dismiss">✕</button>
        </div>
      )}

      {loading ? (
        <BillingSkeleton />
      ) : (
        <>
          <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
            <StaggerItem className="flex">
              <div className="w-full [&>div]:h-full">
                <PlanSummaryCard
                  billingStatus={billingStatus}
                  onPortal={handlePortal}
                  loadingPortal={loadingPortal}
                  onUpgrade={handleUpgrade}
                  onAddExtraSlots={handleAddExtraSlots}
                />
              </div>
            </StaggerItem>
            <StaggerItem className="flex"><CreditBalanceCard className="w-full" /></StaggerItem>
            <StaggerItem className="flex">
              <TopupPacksCard className="w-full" packs={credits.packs} loading={credits.packsLoading} onPick={credits.setCheckoutPack} />
            </StaggerItem>
          </Stagger>

          <section className="flex flex-col gap-3">
            <h2 className="font-pd-display text-[20px] font-bold tracking-[-0.01em] text-pd-ink">
              {billingStatus?.subscribed ? "Compare plans" : "Choose a plan"}
            </h2>
            <Stagger className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3" delay={0.25}>
              {PLANS.map((plan) => (
                <StaggerItem key={plan.id}>
                  <PlanCard
                    plan={plan}
                    billingStatus={billingStatus}
                    onCheckout={handleCheckout}
                    onManage={handlePortal}
                    loadingManage={loadingPortal}
                  />
                </StaggerItem>
              ))}
            </Stagger>
          </section>

          <CreditUsageCard usage={credits.usage} />

          <section className="flex flex-col gap-3">
            <h2 className="font-pd-display text-[20px] font-bold tracking-[-0.01em] text-pd-ink">Questions</h2>
            <Faq />
          </section>
        </>
      )}

      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          email={storedEmail}
          onClose={() => setCheckoutPlan(null)}
          onComplete={handleWhopComplete}
        />
      )}
      {credits.checkoutPack && (
        <TopupModal
          pack={credits.checkoutPack}
          email={credits.storedEmail}
          onClose={() => credits.setCheckoutPack(null)}
          onComplete={credits.handleTopupComplete}
        />
      )}
    </div>
  );
}
