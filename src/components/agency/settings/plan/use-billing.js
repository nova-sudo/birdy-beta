"use client";

// The account's subscription: GET /api/billing/status, the Whop portal,
// cancel and keep, and the Whop checkout for a plan or an extra client slot.
// The same calls /billing and Settings › Billing made before they moved here.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { EXTRA_CLIENT_PRICE, withoutParam } from "@/lib/plan-billing";

// Optional: a separate recurring "extra client slot" plan (Scale add-on).
export const EXTRA_CLIENT_PLAN_ID = process.env.NEXT_PUBLIC_WHOP_PLAN_EXTRA_CLIENT ?? "";

export function useBilling() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("/api/billing/status");
      if (!res.ok) throw new Error("Failed to load billing status");
      setStatus(await res.json());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Whop confirms the purchase to the backend by webhook, which then turns
  // the subscription on. Poll a few times so the page catches up.
  const pollAfterCheckout = useCallback(() => {
    setSuccess("Subscription activated! Your plan is now live.");
    setTimeout(() => void load(), 2000);
    setTimeout(() => void load(), 5000);
    setTimeout(() => void load(), 9000);
  }, [load]);

  useEffect(() => {
    void load();
    // Whop's returnUrl, for payment methods that leave the page (3DS, pay later).
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      window.history.replaceState(null, "", withoutParam(window.location.pathname + window.location.search, "checkout"));
      pollAfterCheckout();
    }
  }, [load, pollAfterCheckout]);

  const openPortal = useCallback(async () => {
    setOpeningPortal(true);
    setError(null);
    try {
      const res = await apiRequest("/api/billing/portal-url");
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to open billing portal");
      if (data.portal_url) window.open(data.portal_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e.message);
    } finally {
      setOpeningPortal(false);
    }
  }, []);

  // Cancelling and keeping happen in place: Whop's API does both. They refetch
  // the status rather than patching it, so the page shows what a reload would.
  const mutate = useCallback(async (endpoint, message) => {
    setBusy(true);
    try {
      const res = await apiRequest(endpoint, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ?? "Something went wrong. Please try again.");
      const refreshed = await apiRequest("/api/billing/status");
      if (refreshed.ok) setStatus(await refreshed.json());
      toast.success(message);
      return true;
    } catch (e) {
      toast.error("Subscription", { description: e.message });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const cancel = useCallback(() => mutate("/api/billing/cancel", "Your subscription will end when the current period does."), [mutate]);
  const reactivate = useCallback(() => mutate("/api/billing/reactivate", "Your subscription will keep running."), [mutate]);

  const startCheckout = useCallback((plan) => {
    setError(null);
    if (!plan.planId) {
      setError(`The ${plan.name} plan isn't available yet. Its Whop plan ID hasn't been configured.`);
      return;
    }
    setCheckout(plan);
  }, []);

  // Extra client slots are their own Whop plan, bought through the same checkout.
  const addExtraSlot = useCallback(() => {
    setError(null);
    if (!EXTRA_CLIENT_PLAN_ID) {
      setError("Extra client slots aren't configured yet.");
      return;
    }
    setCheckout({ id: "extra_client", name: "Extra client slot", price: EXTRA_CLIENT_PRICE, planId: EXTRA_CLIENT_PLAN_ID });
  }, []);

  const checkoutDone = useCallback(() => {
    // Turning the plan on happens through the webhook.
    setCheckout(null);
    void load();
    pollAfterCheckout();
  }, [load, pollAfterCheckout]);

  // Plan changes for a subscriber happen in Whop's portal: Whop has no in-place swap.
  const choosePlan = useCallback((plan) => (status?.subscribed ? openPortal() : startCheckout(plan)), [status?.subscribed, openPortal, startCheckout]);

  return {
    status, loading, loadError, reload: load,
    error, clearError: () => setError(null),
    success, clearSuccess: () => setSuccess(null),
    openingPortal, openPortal,
    busy, cancel, reactivate,
    checkout, closeCheckout: () => setCheckout(null), checkoutDone,
    choosePlan, addExtraSlot,
  };
}
