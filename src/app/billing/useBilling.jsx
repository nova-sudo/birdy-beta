"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, Loader2, Plus } from "lucide-react";

const API_BASE   = process.env.NEXT_PUBLIC_API_BASE ?? "";
const PLAN_ORDER = ["starter", "growth", "scale"];

// ── Context ───────────────────────────────────────────────────────────────────

const BillingContext = createContext(null);

export function BillingProvider({ children }) {
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/billing/status`, { credentials: "include" });
      if (res.ok) setStatus(await res.json());
    } catch {
      // silently fail — billing check should never break the app
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <BillingContext.Provider value={{ status, loading, refresh }}>
      {children}
    </BillingContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBilling() {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used inside <BillingProvider>");

  const { status, loading, refresh } = ctx;

  const subscribed      = status?.subscribed ?? false;
  const plan            = status?.plan ?? { id: "free", name: "Free", max_clients: 0 };
  const subStatus       = status?.status ?? "inactive";
  const clientCount     = status?.client_count ?? 0;
  const clientLimit     = status?.client_limit ?? 0;
  const extraClients    = status?.extra_clients_paid ?? 0;
  const canAddExtraSlots = status?.can_add_extra_slots ?? false;
  const atLimit         = subscribed && clientCount >= clientLimit;
  const nearLimit       = subscribed && clientCount >= clientLimit - 1 && !atLimit;

  return {
    loading,
    subscribed,
    plan,
    status: subStatus,
    clientCount,
    clientLimit,
    extraClients,
    canAddExtraSlots,
    atLimit,
    nearLimit,
    refresh,
  };
}

// ── SubscriptionGate ──────────────────────────────────────────────────────────

export function SubscriptionGate({ children, fallback, requirePlan }) {
  const { loading, subscribed, plan } = useBilling();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  const meetsRequirement =
    subscribed &&
    (!requirePlan || PLAN_ORDER.indexOf(plan.id) >= PLAN_ORDER.indexOf(requirePlan));

  if (meetsRequirement) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  const planLabel = requirePlan
    ? requirePlan.charAt(0).toUpperCase() + requirePlan.slice(1)
    : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Lock className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        {planLabel ? `${planLabel} plan required` : "Subscription required"}
      </h3>
      <p className="text-gray-500 max-w-sm mb-6">
        {planLabel
          ? `This feature requires the ${planLabel} plan or higher.`
          : "Subscribe to access this feature and connect your clients."}
      </p>
      <button
        type="button"
        onClick={() => router.push("/billing")}
        className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors"
      >
        View Plans
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── ClientLimitWarning ────────────────────────────────────────────────────────

export function ClientLimitWarning() {
  const { subscribed, atLimit, nearLimit, clientCount, clientLimit, plan, canAddExtraSlots } = useBilling();
  const router = useRouter();

  if (!subscribed || (!atLimit && !nearLimit)) return null;

  // Scale users at limit → prompt to add extra slots
  if (atLimit && canAddExtraSlots) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700">
        <Plus className="w-4 h-4 flex-shrink-0" />
        <p>
          You&apos;ve reached your {plan.name} plan limit of {clientLimit} clients.{" "}
          <button
            type="button"
            onClick={() => router.push("/billing")}
            className="underline font-medium hover:no-underline"
          >
            Add extra client slots ($10/mo each)
          </button>
        </p>
      </div>
    );
  }

  // Starter / Growth users at limit → prompt to upgrade
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm mb-4 ${
      atLimit
        ? "bg-red-50 border border-red-200 text-red-700"
        : "bg-amber-50 border border-amber-200 text-amber-700"
    }`}>
      <Lock className="w-4 h-4 flex-shrink-0" />
      <p>
        {atLimit
          ? `You've reached your ${plan.name} plan limit of ${clientLimit} clients. `
          : `You're using ${clientCount} of ${clientLimit} client slots. `}
        <button
          type="button"
          onClick={() => router.push("/billing")}
          className="underline font-medium hover:no-underline"
        >
          {atLimit ? "Upgrade to add more" : "Upgrade your plan"}
        </button>
      </p>
    </div>
  );
}