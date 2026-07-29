"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Check, Zap, TrendingUp, Building2,
  Plus, Minus, ExternalLink, AlertCircle,
  Loader2, Crown,
} from "lucide-react";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";

// Whop plan IDs (plan_XXXXXXXX) are created in the Whop dashboard
// (Checkout Links → Details) and injected via env. Set the environment to
// "sandbox" to run Whop's test mode, "production" for live charges.
const WHOP_ENVIRONMENT =
  (process.env.NEXT_PUBLIC_WHOP_ENVIRONMENT ?? "production") === "sandbox"
    ? "sandbox"
    : "production";
const EXTRA_CLIENT_PRICE = 10;

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 97,
    maxClients: 3,
    planId: process.env.NEXT_PUBLIC_WHOP_PLAN_STARTER ?? "",
    icon: Zap,
    color: "blue",
    supportsExtraSlots: false,
    features: ["Up to 3 client groups"],
  },
  {
    id: "growth",
    name: "Growth",
    price: 297,
    maxClients: 10,
    planId: process.env.NEXT_PUBLIC_WHOP_PLAN_GROWTH ?? "",
    icon: TrendingUp,
    color: "purple",
    popular: true,
    supportsExtraSlots: false,
    features: ["Up to 10 client groups"],
  },
  {
    id: "scale",
    name: "Scale",
    price: 497,
    maxClients: 25,
    planId: process.env.NEXT_PUBLIC_WHOP_PLAN_SCALE ?? "",
    icon: Building2,
    color: "emerald",
    supportsExtraSlots: true,
    features: [
      "Up to 25 client groups",
      "Extra client slots (+$10/mo each)",
    ],
  },
];

const PLAN_ORDER = ["starter", "growth", "scale"];

const COLOR_CLASSES = {
  blue: { bg: "bg-blue-600", light: "bg-blue-50", border: "border-blue-500", text: "text-blue-600", button: "bg-blue-600 hover:bg-blue-700", badge: "bg-blue-100 text-blue-700" },
  purple: { bg: "bg-purple-600", light: "bg-purple-50", border: "border-purple-500", text: "text-purple-600", button: "bg-purple-600 hover:bg-purple-700", badge: "bg-purple-100 text-purple-700" },
  emerald: { bg: "bg-emerald-600", light: "bg-emerald-50", border: "border-emerald-500", text: "text-emerald-600", button: "bg-emerald-600 hover:bg-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
};

// Best-effort read of the signed-in user's email so we can prefill the Whop
// checkout form (and give the backend webhook a stable key to reconcile the
// purchase against the account).
function getStoredEmail() {
  if (typeof window === "undefined") return "";
  try {
    return JSON.parse(localStorage.getItem("user"))?.email ?? "";
  } catch {
    return "";
  }
}

function StatusBadge({ status }) {
  const styles = {
    active: "bg-green-100 text-green-700 border-green-200",
    trialing: "bg-blue-100 text-blue-700 border-blue-200",
    past_due: "bg-amber-100 text-amber-700 border-amber-200",
    canceled: "bg-red-100 text-red-700 border-red-200",
    inactive: "bg-gray-100 text-gray-600 border-gray-200",
  };
  const labels = { active: "Active", trialing: "Trial", past_due: "Past Due", canceled: "Canceled", inactive: "No Plan" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] ?? styles.inactive}`}>
      {labels[status] ?? status}
    </span>
  );
}

function PlanCard({
  plan, billingStatus, onCheckout, onChangePlan, onAddExtraSlots,
  loadingPlanId, loadingExtra, extraClients, setExtraClients,
}) {
  const Icon = plan.icon;
  const c = COLOR_CLASSES[plan.color];
  const isCurrent = billingStatus?.plan?.id === plan.id && billingStatus?.subscribed;
  const isLoading = loadingPlanId === plan.id;
  const isDowngrade = billingStatus?.subscribed && PLAN_ORDER.indexOf(plan.id) < PLAN_ORDER.indexOf(billingStatus.plan?.id);

  // When Scale is the current plan, show an "Add slots" button instead of
  // "Current Plan". Extra slots are added to a live subscription via the
  // backend change-plan flow — Whop's embedded checkout is single-plan, so
  // they can't be bundled into the initial subscribe.
  const scaleIsCurrentPlan = isCurrent && plan.supportsExtraSlots;

  // The extra-slots picker only applies to an already-active Scale plan.
  const showExtraSlotsUI = scaleIsCurrentPlan;

  return (
    <div className={[
      "relative flex flex-col rounded-2xl border-2 bg-white overflow-hidden transition-all duration-200",
      isCurrent ? c.border : "border-gray-200 hover:border-gray-300",
      plan.popular ? "shadow-xl scale-105" : "shadow-sm",
    ].join(" ")}>

      {plan.popular && (
        <div className={`absolute top-0 left-0 right-0 text-center py-1 text-xs font-semibold text-white ${c.bg}`}>
          Most Popular
        </div>
      )}

      <div className={`p-6 ${plan.popular ? "pt-8" : ""} flex flex-col flex-1`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-xl ${c.light}`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
            <p className="text-sm text-gray-500">Up to {plan.maxClients} clients</p>
          </div>
          {isCurrent && (
            <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${c.badge}`}>
              Current
            </span>
          )}
        </div>

        <div className="mb-6">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold text-gray-900">${plan.price}</span>
            <span className="text-gray-500">/mo</span>
          </div>
          {showExtraSlotsUI && extraClients > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              +${extraClients * EXTRA_CLIENT_PRICE}/mo for {extraClients} extra slot{extraClients !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <ul className="space-y-2.5 mb-6 flex-1">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
              <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${c.text}`} />
              {f}
            </li>
          ))}
          {/* Show currently purchased extra slots when Scale is active */}
          {scaleIsCurrentPlan && billingStatus.extra_clients_paid > 0 && (
            <li className="flex items-start gap-2 text-sm text-emerald-600 font-medium">
              <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
              {billingStatus.extra_clients_paid} extra slot{billingStatus.extra_clients_paid !== 1 ? "s" : ""} active
            </li>
          )}
        </ul>

        {/* Extra slots picker — shown for an active Scale subscription */}
        {showExtraSlotsUI && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
            <p className="text-xs font-medium text-emerald-700 mb-2">
              Add extra client slots{" "}
              <span className="text-emerald-500">(+$10/mo each)</span>
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setExtraClients(Math.max(0, extraClients - 1))}
                className="p-1 rounded-lg border border-emerald-200 hover:bg-emerald-100"
              >
                <Minus className="w-3.5 h-3.5 text-emerald-700" />
              </button>
              <span className="text-sm font-semibold w-4 text-center text-emerald-900">{extraClients}</span>
              <button
                type="button"
                onClick={() => setExtraClients(extraClients + 1)}
                className="p-1 rounded-lg border border-emerald-200 hover:bg-emerald-100"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-700" />
              </button>
            </div>
          </div>
        )}

        {/* CTA buttons */}
        {scaleIsCurrentPlan ? (
          // Scale current plan: show "Add X Slots" button (active only when extraClients > 0)
          <button
            type="button"
            onClick={() => extraClients > 0 && onAddExtraSlots(plan, extraClients)}
            disabled={extraClients === 0 || loadingExtra}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${c.button} disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {loadingExtra
              ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
              : extraClients > 0
                ? `Add ${extraClients} Slot${extraClients !== 1 ? "s" : ""} (+$${extraClients * EXTRA_CLIENT_PRICE}/mo)`
                : "Select slots above to add"}
          </button>
        ) : isCurrent ? (
          <div className={`w-full py-2.5 rounded-xl text-sm font-semibold text-center ${c.light} ${c.text} border ${c.border}`}>
            ✓ Current Plan
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              billingStatus?.subscribed
                ? onChangePlan(plan)
                : onCheckout(plan)
            }
            disabled={isLoading}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${c.button} disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
              : billingStatus?.subscribed
                ? (isDowngrade ? "Downgrade" : "Upgrade")
                : "Get Started"}
          </button>
        )}
      </div>
    </div>
  );
}

function CurrentPlanBar({ billingStatus, onPortal, loadingPortal }) {
  const plan = PLANS.find((p) => p.id === billingStatus.plan?.id);
  if (!plan) return null;

  const c = COLOR_CLASSES[plan.color];
  const usagePct = Math.min(100, (billingStatus.client_count / Math.max(billingStatus.client_limit, 1)) * 100);

  return (
    <div className={`rounded-2xl border-2 ${c.border} ${c.light} p-5 mb-8`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Crown className={`w-6 h-6 ${c.text}`} />
          <div>
            <p className="text-xs text-gray-500 font-medium">Current Plan</p>
            <h3 className={`text-xl font-bold ${c.text}`}>{plan.name}</h3>
          </div>
          <StatusBadge status={billingStatus.status} />
        </div>

        <div className="flex-1">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Client groups</span>
            <span className="font-medium text-gray-700">
              {billingStatus.client_count} / {billingStatus.client_limit}
              {billingStatus.extra_clients_paid > 0 && (
                <span className="ml-1 text-emerald-600">
                  (+{billingStatus.extra_clients_paid} extra)
                </span>
              )}
            </span>
          </div>
          <div className="h-2 bg-white rounded-full border border-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full ${usagePct >= 90 ? "bg-red-500" : c.bg}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>

        {billingStatus.current_period_end && (
          <div className="text-sm text-gray-600 shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">
              {billingStatus.cancel_at_period_end ? "Cancels" : "Renews"}
            </p>
            <p className="font-medium">
              {new Date(billingStatus.current_period_end).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onPortal}
          disabled={loadingPortal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-white transition-colors disabled:opacity-60 shrink-0"
        >
          {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          Manage Billing
        </button>
      </div>

      {billingStatus.cancel_at_period_end && (
        <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Your subscription will cancel at the end of this billing period.
        </div>
      )}
    </div>
  );
}

// Modal that mounts the Whop embedded checkout for the selected plan.
function CheckoutModal({ plan, email, onClose, onComplete }) {
  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/billing?checkout=success`
      : undefined;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 border-b border-gray-100 text-left">
          <DialogTitle>Subscribe to {plan.name}</DialogTitle>
          <DialogDescription>
            ${plan.price}/mo · Secure checkout powered by Whop
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          <WhopCheckoutEmbed
            planId={plan.planId}
            environment={WHOP_ENVIRONMENT}
            theme="light"
            skipRedirect
            returnUrl={returnUrl}
            prefill={email ? { email } : undefined}
            onComplete={onComplete}
            fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BillingPage() {
  const [billingStatus, setBillingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlanId, setLoadingPlanId] = useState(null);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [extraClients, setExtraClients] = useState(0);
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [storedEmail] = useState(getStoredEmail);

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
    setSuccessMsg("🎉 Subscription activated! Your plan is now live.");
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

  const handleWhopComplete = useCallback((planId, receiptId) => {
    // planId / receiptId are also available if the backend needs them for
    // client-side reconciliation; activation itself happens via the webhook.
    setCheckoutPlan(null);
    void fetchStatus();
    pollAfterCheckout();
  }, [fetchStatus, pollAfterCheckout]);

  const handleChangePlan = async (plan) => {
    if (!plan.planId) {
      setError(`The ${plan.name} plan isn't available yet — its Whop plan ID hasn't been configured.`);
      return;
    }
    if (!window.confirm(`Switch to the ${plan.name} plan? Proration will be applied immediately.`)) return;
    setLoadingPlanId(plan.id);
    setError(null);
    try {
      const res = await apiRequest("/api/billing/change-plan", {
        method: "POST",
        body: JSON.stringify({ new_plan_id: plan.planId, extra_clients: 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to change plan");
      setSuccessMsg(`✓ Plan changed to ${plan.name}!`);
      setExtraClients(0);
      await fetchStatus();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingPlanId(null);
    }
  };

  // Called when a Scale user who is already subscribed adds more extra slots
  const handleAddExtraSlots = async (plan, extras) => {
    if (!window.confirm(`Add ${extras} extra client slot${extras !== 1 ? "s" : ""} for +$${extras * EXTRA_CLIENT_PRICE}/mo? Charged immediately on a prorated basis.`)) return;
    setLoadingExtra(true);
    setError(null);
    try {
      const currentExtra = billingStatus?.extra_clients_paid ?? 0;
      const newTotal = currentExtra + extras;

      const res = await apiRequest("/api/billing/change-plan", {
        method: "POST",
        // Keep Scale plan, bump total extra slots to currentExtra + new extras
        body: JSON.stringify({ new_plan_id: plan.planId, extra_clients: newTotal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to add extra slots");
      setSuccessMsg(`✓ Added ${extras} extra client slot${extras !== 1 ? "s" : ""}! Your new limit is ${25 + newTotal} clients.`);
      setExtraClients(0);
      await fetchStatus();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingExtra(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen ">

      <div className="max-w-6xl mx-auto px-4 py-12">

        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-3">Simple, Transparent Pricing</h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Connect your clients, track your campaigns, and scale your agency—all in one place.
          </p>
        </div>

        {successMsg && (
          <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700">
            <Check className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{successMsg}</p>
            <button type="button" onClick={() => setSuccessMsg(null)} className="ml-auto text-green-400 hover:text-green-600">✕</button>
          </div>
        )}
        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
            <button type="button" onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {billingStatus?.subscribed && (
          <CurrentPlanBar
            billingStatus={billingStatus}
            onPortal={handlePortal}
            loadingPortal={loadingPortal}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billingStatus={billingStatus}
              onCheckout={handleCheckout}
              onChangePlan={handleChangePlan}
              onAddExtraSlots={handleAddExtraSlots}
              loadingPlanId={loadingPlanId}
              loadingExtra={loadingExtra}
              extraClients={extraClients}
              setExtraClients={setExtraClients}
            />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          On the Scale plan?{" "}
          <span className="font-medium text-gray-700">Add extra client slots for $10/mo each</span>
          {" "}— use the Scale card above, or manage via the billing portal.
        </p>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { q: "Can I change plans at any time?", a: "Yes. Upgrades are applied immediately with prorated billing. Downgrades take effect at the end of your current billing period." },
            { q: "What counts as a client group?", a: "Each connected client (with a GHL location, Meta ad account, or HotProspector group) counts as one client group toward your limit." },
            { q: "What are extra client slots?", a: "Scale plan users can purchase additional client slots for $10/mo each, beyond the included 25. Starter and Growth plans must upgrade to add more clients." },
            { q: "How do I cancel?", a: "Click 'Manage Billing' to access the Whop customer portal, where you can cancel at any time. You'll keep access until the end of your billing period." },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-1.5">{q}</h4>
              <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>

      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          email={storedEmail}
          onClose={() => setCheckoutPlan(null)}
          onComplete={handleWhopComplete}
        />
      )}
    </div>
  );
}
