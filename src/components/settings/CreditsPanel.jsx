"use client";

import { useEffect, useState, useCallback } from "react";
import { Zap, Loader2, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp, EASE_OUT } from "@/components/motion";
import { apiRequest } from "@/lib/api";
import { useCredits } from "@/hooks/useCredits";
import { cn } from "@/lib/utils";

const WHOP_ENVIRONMENT =
  (process.env.NEXT_PUBLIC_WHOP_ENVIRONMENT ?? "production") === "sandbox" ? "sandbox" : "production";

const FEATURE_LABELS = { ask_birdy: "Ask Birdy", suggestions: "Suggestions" };

const TOPUP_SUCCESS = "Credits added! Your new balance is on the way.";

function getStoredEmail() {
  if (typeof window === "undefined") return "";
  try {
    return JSON.parse(localStorage.getItem("user"))?.email ?? "";
  } catch {
    return "";
  }
}

// Top-up checkout in a modal (mirrors the billing page's Whop embed).
export function TopupModal({ pack, email, onClose, onComplete }) {
  const [appliedPromo, setAppliedPromo] = useState(null);
  const returnUrl =
    typeof window !== "undefined" ? `${window.location.origin}/billing?topup=success` : undefined;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 py-4 border-b border-pd-border text-left">
          <DialogTitle className="font-pd-display text-[18px]">{pack.credits.toLocaleString()} Birdy Credits</DialogTitle>
          <DialogDescription>${pack.price} · Secure checkout powered by Whop</DialogDescription>
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
            planId={pack.plan_id}
            environment={WHOP_ENVIRONMENT}
            theme="light"
            skipRedirect
            returnUrl={returnUrl}
            prefill={email ? { email } : undefined}
            onComplete={onComplete}
            onPromoCodeChanged={setAppliedPromo}
            fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-pd-faint" />
              </div>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A dismissible confirmation strip for a finished purchase. */
export function SuccessBanner({ message, onDismiss, className }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      className={cn("flex items-center gap-3 rounded-2xl bg-pd-success px-4 py-3 text-white shadow-sm", className)}
    >
      <Check className="w-5 h-5 shrink-0" />
      <p className="text-sm font-semibold">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ml-auto flex size-7 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  );
}

/**
 * Usage, top-up packs and the purchase flow, shared by the billing hub and
 * the Settings Billing tab so the two can't drift apart.
 */
export function useCreditsData() {
  const { refresh } = useCredits();
  const [usage, setUsage] = useState(null);
  const [packs, setPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [checkoutPack, setCheckoutPack] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [storedEmail] = useState(getStoredEmail);

  const loadUsage = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([
        apiRequest("/api/credits/usage?days=30"),
        apiRequest("/api/credits/topup-packs"),
      ]);
      if (u.ok) setUsage(await u.json());
      if (p.ok) setPacks((await p.json()).packs || []);
    } catch {
      // Non-fatal — the balance still renders from the shared status.
    } finally {
      setPacksLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsage(); }, [loadUsage]);

  // After a top-up the webhook updates the backend; poll a couple of times.
  const pollAfterTopup = useCallback(() => {
    setSuccessMsg(TOPUP_SUCCESS);
    setTimeout(() => { void refresh(); void loadUsage(); }, 2000);
    setTimeout(() => { void refresh(); void loadUsage(); }, 5000);
  }, [refresh, loadUsage]);

  // Return from a redirect-based checkout.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") === "success") {
      window.history.replaceState({}, "", window.location.pathname);
      pollAfterTopup();
    }
  }, [pollAfterTopup]);

  const handleTopupComplete = () => {
    setCheckoutPack(null);
    pollAfterTopup();
  };

  // The 10k pack is a bulk tier sold separately; the strip offers three.
  const visiblePacks = packs.filter((pack) => pack.credits < 10_000);

  return {
    usage,
    packs: visiblePacks,
    packsLoading,
    checkoutPack,
    setCheckoutPack,
    successMsg,
    setSuccessMsg,
    storedEmail,
    handleTopupComplete,
  };
}

/** Ring showing how much of this period's allowance is left. */
function AllowanceRing({ pct, tone }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const stroke = { danger: "var(--pd-danger)", warning: "var(--pd-warning)", primary: "var(--pd-primary)" }[tone];
  return (
    <div className="relative size-[92px] shrink-0">
      <svg viewBox="0 0 92 92" className="size-full -rotate-90">
        <circle cx="46" cy="46" r={r} fill="none" stroke="var(--pd-divider)" strokeWidth="9" />
        <motion.circle
          cx="46" cy="46" r={r} fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.2 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-pd-display text-[17px] font-bold text-pd-ink">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export function CreditBalanceCard({ className }) {
  const { status, loading, balance, topupBalance, allowance, remainingAllowance, isOut, low, enforced } = useCredits();

  if (loading && !status) {
    return (
      <div className={cn("rounded-xl border border-pd-border bg-pd-surface p-5 shadow-sm", className)}>
        <Skeleton className="h-3 w-20" />
        <div className="mt-4 flex items-center gap-4">
          <Skeleton className="size-[92px] rounded-full" />
          <div className="flex-1"><Skeleton className="h-8 w-24" /><Skeleton className="mt-2 h-3 w-32" /></div>
        </div>
      </div>
    );
  }

  const tone = isOut ? "danger" : low ? "warning" : "primary";
  const pct = allowance > 0 ? Math.min(100, Math.max(0, (remainingAllowance / allowance) * 100)) : null;

  return (
    <div className={cn("rounded-xl border border-pd-border bg-pd-surface p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-pd-subtle">AI credits</span>
        {isOut ? (
          <span className="rounded-full bg-pd-danger px-2.5 py-0.5 text-[11.5px] font-bold text-white">Out of credits</span>
        ) : low ? (
          <span className="rounded-full bg-pd-warning px-2.5 py-0.5 text-[11.5px] font-bold text-white">Running low</span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-4">
        {pct != null && <AllowanceRing pct={pct} tone={tone} />}
        <div className="min-w-0">
          <div className={cn("font-pd-display text-[30px] font-extrabold leading-none tracking-[-0.02em]", isOut ? "text-pd-danger" : "text-pd-ink")}>
            <CountUp value={balance.toLocaleString("en-GB")} />
          </div>
          <p className="mt-1.5 text-[12.5px] text-pd-subtle">
            credits left
            {topupBalance > 0 && <> · includes {topupBalance.toLocaleString()} top-up</>}
          </p>
          {!enforced && (
            <p className="mt-1.5 text-[11.5px] text-pd-faint">Metering is live; usage isn&apos;t blocked yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function TopupPacksCard({ packs, loading, onPick, className }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border border-pd-border bg-pd-surface p-5 shadow-sm", className)}>
      <span className="text-[12.5px] font-medium text-pd-subtle">Top up credits</span>
      {loading
        ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[46px] w-full rounded-2xl" />)
        : packs.map((pack) => {
            const configured = !!pack.plan_id;
            return (
              <button
                key={pack.id}
                type="button"
                disabled={!configured}
                onClick={() => configured && onPick(pack)}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-pd-border px-3.5 py-2.5 text-left transition-[border-color,background-color,transform] duration-200 hover:border-pd-primary hover:bg-pd-primary-tint/50 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pd-border disabled:hover:bg-transparent"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-[10px] bg-pd-primary-tint text-pd-primary transition-colors group-hover:bg-pd-primary group-hover:text-white">
                    <Zap className="size-3.5" />
                  </span>
                  <span className="text-[13.5px] font-semibold text-pd-ink">{pack.credits.toLocaleString()} credits</span>
                </span>
                <span className="text-[13px] font-semibold text-pd-subtle">
                  {configured ? `$${pack.price}` : "Soon"}
                </span>
              </button>
            );
          })}
    </div>
  );
}

export function CreditUsageCard({ usage, className }) {
  return (
    <div className={cn("rounded-xl border border-pd-border bg-pd-surface p-5 shadow-sm", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-pd-display text-[16px] font-semibold text-pd-ink">AI usage · last 30 days</h2>
        {usage && (
          <span className="text-[12.5px] text-pd-subtle">
            {usage.total_questions.toLocaleString()} questions · {Math.round(usage.total_credits).toLocaleString()} credits
          </span>
        )}
      </div>

      {!usage ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : usage.by_day.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-pd-faint">No AI usage yet in this window.</p>
      ) : (
        <>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usage.by_day} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFEEEB" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10.5, fill: "#98989E" }}
                  tickFormatter={(d) => d.slice(5)}
                  interval="preserveStartEnd"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10.5, fill: "#98989E" }} allowDecimals={false} width={40} axisLine={false} tickLine={false} />
                <RTooltip
                  cursor={{ fill: "rgba(91,63,214,.06)", radius: 8 }}
                  formatter={(v) => [`${Math.round(v)} credits`, "Used"]}
                  labelStyle={{ fontSize: 12, color: "#18181B", fontWeight: 600 }}
                  contentStyle={{ fontSize: 12, borderRadius: 14, border: "1px solid #E7E6E3", boxShadow: "0 14px 34px -12px rgba(24,24,27,.26)" }}
                />
                <Bar dataKey="credits" fill="#5B3FD6" radius={[8, 8, 3, 3]} maxBarSize={26} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {Object.keys(usage.by_feature || {}).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(usage.by_feature).map(([feat, credits]) => (
                <span key={feat} className="inline-flex items-center gap-1.5 rounded-full bg-pd-divider px-3 py-1 text-xs text-pd-body">
                  <span className="font-semibold text-pd-ink">{FEATURE_LABELS[feat] ?? feat}</span>
                  {Math.round(credits).toLocaleString()} credits
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Balance, top-up packs and usage in one block — the Settings Billing tab's
 * credits section. The billing hub lays the same pieces out itself.
 */
export function CreditsPanel() {
  const data = useCreditsData();
  return (
    <div className="flex w-full flex-col gap-4">
      <SuccessBanner message={data.successMsg} onDismiss={() => data.setSuccessMsg(null)} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CreditBalanceCard />
        <TopupPacksCard packs={data.packs} loading={data.packsLoading} onPick={data.setCheckoutPack} />
      </div>
      <CreditUsageCard usage={data.usage} />
      {data.checkoutPack && (
        <TopupModal
          pack={data.checkoutPack}
          email={data.storedEmail}
          onClose={() => data.setCheckoutPack(null)}
          onComplete={data.handleTopupComplete}
        />
      )}
    </div>
  );
}
