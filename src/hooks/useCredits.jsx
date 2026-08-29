"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { apiRequest } from "@/lib/api";

// ── Context ─────────────────────────────────────────────────────────────────
// Mirrors the billing provider pattern, but uses apiRequest (bearer + 401
// handling) since /api/credits/* is authenticated. Mounted only inside the
// authed app shell (see layout.jsx), so it never fires on public pages.

const CreditsContext = createContext(null);

export function CreditsProvider({ children }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await apiRequest("/api/credits/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      // Credits must never break the app.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <CreditsContext.Provider value={{ status, loading, refresh }}>
      {children}
    </CreditsContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useCredits() {
  // Tolerate rendering outside the provider (isolated surfaces / SSR) — return
  // safe defaults instead of throwing.
  const ctx = useContext(CreditsContext) ?? { status: null, loading: false, refresh: () => {} };
  const { status, loading, refresh } = ctx;

  const allowance = status?.allowance ?? 0;
  const used = status?.used ?? 0;
  const balance = status?.balance ?? 0;
  const topupBalance = status?.topup_balance ?? 0;
  const remainingAllowance = status?.remaining_allowance ?? Math.max(0, allowance - used);

  const subscribed = status?.subscribed ?? false;
  const enforced = status?.enforced ?? false;
  const low = status?.low ?? false;
  const isOut = status?.out ?? false;

  return {
    loading,
    status,
    refresh,
    allowance,
    used,
    balance,
    topupBalance,
    remainingAllowance,
    subscribed,
    enforced,
    low,
    isOut,
    // Hard-block only when enforcement is actually on (staged rollout: metering
    // ships first, the stopper is turned on later with CREDITS_ENFORCE).
    blocked: enforced && isOut,
    rateMode: status?.rate_mode ?? "byok",
    planId: status?.plan_id ?? "free",
    currentPeriodEnd: status?.current_period_end ?? null,
  };
}
