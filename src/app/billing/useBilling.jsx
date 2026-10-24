"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, Plus } from "lucide-react";
import { Button, Skeleton, SystemBanner } from "@/components/ds";

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
      <div className="space-y-3 p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-40 w-full rounded-surface" />
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
      <div className="w-16 h-16 bg-primary-soft text-primary rounded-full flex items-center justify-center mb-4">
        <Lock className="w-7 h-7" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        {planLabel ? `${planLabel} plan required` : "Subscription required"}
      </h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        {planLabel
          ? `This feature requires the ${planLabel} plan or higher.`
          : "Subscribe to access this feature and connect your clients."}
      </p>
      <Button variant="primary" onClick={() => router.push("/billing")} className="gap-2">
        View plans
        <ArrowRight className="w-4 h-4" />
      </Button>
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
      <SystemBanner tone="success" className="mb-4 rounded-control font-medium">
        <span className="flex items-center gap-3">
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span>
            You&apos;ve reached your {plan.name} plan limit of {clientLimit} clients.{" "}
            <button
              type="button"
              onClick={() => router.push("/billing")}
              className="underline font-semibold underline-offset-2 hover:no-underline"
            >
              Add extra client slots ($10/mo each)
            </button>
          </span>
        </span>
      </SystemBanner>
    );
  }

  // Starter / Growth users at limit → prompt to upgrade
  return (
    <SystemBanner tone={atLimit ? "danger" : "warning"} className="mb-4 rounded-control font-medium">
      <span className="flex items-center gap-3">
        <Lock className="w-4 h-4 flex-shrink-0" />
        <span>
          {atLimit
            ? `You've reached your ${plan.name} plan limit of ${clientLimit} clients. `
            : `You're using ${clientCount} of ${clientLimit} client slots. `}
          <button
            type="button"
            onClick={() => router.push("/billing")}
            className="underline font-semibold underline-offset-2 hover:no-underline"
          >
            {atLimit ? "Upgrade to add more" : "Upgrade your plan"}
          </button>
        </span>
      </span>
    </SystemBanner>
  );
}
