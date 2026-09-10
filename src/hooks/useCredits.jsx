"use client";

import { createContext, useContext, useMemo } from "react";
import useSWR from "swr";
import { optionalFetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";

// ── Context ─────────────────────────────────────────────────────────────────
// Mounted only inside the authed app shell (see layout.jsx), so it never fires
// on public pages. The context is kept even though SWR would already share one
// request across every consumer: it is what guarantees the *provider* is the
// only thing that decides whether credits are being fetched at all.

const CreditsContext = createContext(null);

export function CreditsProvider({ children }) {
  // optionalFetcher, not fetcher: credits must never break the app, which is
  // what the old bare `catch {}` was for. A failure leaves status null and
  // every derived figure falls back to its zero below.
  const { data: status, isLoading, mutate } = useSWR(
    queryKeys.creditsStatus(),
    optionalFetcher
  );

  // Loading only while there is nothing to show — see useClientGroups for why
  // SWR's isLoading alone is the wrong question.
  const value = useMemo(
    () => ({
      status: status ?? null,
      loading: isLoading && status === undefined,
      refresh: mutate,
    }),
    [status, isLoading, mutate]
  );

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
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
