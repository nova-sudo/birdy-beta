"use client";

// AI credits beyond the balance: 30 days of usage, the top-up packs, and the
// Whop top-up checkout. The balance itself comes from the shared useCredits.

import { useCallback, useEffect, useState } from "react";
import { WHOP_RETURN_PARAMS, checkoutOutcome, checkoutProblem } from "@/components/billing/whop";
import { apiRequest } from "@/lib/api";
import { useCredits } from "@/hooks/useCredits";
import { offeredPacks, withoutParam } from "@/lib/plan-billing";

const TOPUP_SUCCESS = "Credits added! Your new balance is on the way.";

export function useCreditUsage() {
  const { refresh } = useCredits();
  const [usage, setUsage] = useState(null);
  const [usageLoaded, setUsageLoaded] = useState(false);
  const [packs, setPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [pack, setPack] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([apiRequest("/api/credits/usage?days=30"), apiRequest("/api/credits/topup-packs")]);
      if (u.ok) setUsage(await u.json());
      if (p.ok) setPacks((await p.json()).packs || []);
    } catch {
      // Not fatal: the balance still shows from the shared status.
    } finally {
      setUsageLoaded(true);
      setPacksLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // After a top-up the webhook updates the backend; poll a couple of times.
  const pollAfterTopup = useCallback(() => {
    setSuccess(TOPUP_SUCCESS);
    setTimeout(() => { void refresh(); void load(); }, 2000);
    setTimeout(() => { void refresh(); void load(); }, 5000);
  }, [refresh, load]);

  // Back from a checkout that left the page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") === "success") {
      window.history.replaceState(null, "", withoutParam(window.location.pathname + window.location.search, "topup", ...WHOP_RETURN_PARAMS));
      const problem = checkoutProblem(checkoutOutcome(params));
      if (problem) setError(problem);
      else pollAfterTopup();
    }
  }, [pollAfterTopup]);

  const topupDone = useCallback(() => {
    setPack(null);
    pollAfterTopup();
  }, [pollAfterTopup]);

  return {
    usage, usageLoaded,
    packs: offeredPacks(packs), packsLoading,
    pack, pickPack: setPack, closePack: () => setPack(null), topupDone,
    success, clearSuccess: () => setSuccess(null),
    error, clearError: () => setError(null),
  };
}
