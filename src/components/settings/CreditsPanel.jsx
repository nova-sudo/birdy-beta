"use client";

import { useEffect, useState, useCallback } from "react";
import { Zap, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Skeleton,
  AlertDiscIcon,
} from "@/components/ds";
import { CountUp, EASE_OUT } from "@/components/motion";
import { apiRequest } from "@/lib/api";
import { useCredits } from "@/hooks/useCredits";
import { cn } from "@/lib/utils";

const WHOP_ENVIRONMENT =
  (process.env.NEXT_PUBLIC_WHOP_ENVIRONMENT ?? "production") === "sandbox" ? "sandbox" : "production";

const FEATURE_LABELS = { ask_birdy: "Ask Birdy", suggestions: "Suggestions" };

const TOPUP_SUCCESS = "Credits added! Your new balance is on the way.";

function getStoredEmail() {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pack.credits.toLocaleString()} Birdy Credits</DialogTitle>
          <DialogDescription>${pack.price} · Secure checkout powered by Whop</DialogDescription>
        </DialogHeader>
        <div>
          {appliedPromo && (
            <div className="mb-3 flex items-center gap-2 rounded-control bg-success-soft px-3 py-2 text-sm text-success-ink">
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

/** A dismissible confirmation strip for a finished purchase. */
export function SuccessBanner({ message, onDismiss, className }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      className={cn("flex items-center gap-3 rounded-surface bg-success px-4 py-3 text-primary-foreground shadow-floating", className)}
    >
      <Check className="w-5 h-5 shrink-0" />
      <p className="text-sm font-semibold">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ml-auto flex size-7 items-center justify-center rounded-control text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
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
  // Read after mount: the stored user is browser-only state.
  const [storedEmail, setStoredEmail] = useState("");
  useEffect(() => { setStoredEmail(getStoredEmail()); }, []);

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
  const stroke = { danger: "var(--color-danger)", warning: "var(--color-warning)", primary: "var(--color-primary)" }[tone];
  return (
    <div className="relative size-[92px] shrink-0">
      <svg viewBox="0 0 92 92" className="size-full -rotate-90">
        <circle cx="46" cy="46" r={r} fill="none" stroke="var(--color-border)" strokeWidth="9" />
        <motion.circle
          cx="46" cy="46" r={r} fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.2 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center num text-lg font-semibold text-foreground">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export function CreditBalanceCard({ className }) {
  const { status, loading, balance, topupBalance, allowance, remainingAllowance, isOut, low, enforced } = useCredits();

  if (loading && !status) {
    return (
      <div className={cn("rounded-surface bg-background p-5 shadow-surface", className)}>
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
    <div className={cn("rounded-surface bg-background p-5 shadow-surface", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">AI credits</span>
        {isOut ? (
          <Badge tone="danger" icon={AlertDiscIcon}>Out of credits</Badge>
        ) : low ? (
          <Badge tone="warning" icon={AlertDiscIcon}>Running low</Badge>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-4">
        {pct != null && <AllowanceRing pct={pct} tone={tone} />}
        <div className="min-w-0">
          <div className={cn("num text-2xl font-semibold leading-none", isOut ? "text-danger-ink" : "text-foreground")}>
            <CountUp value={balance.toLocaleString("en-GB")} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            credits left
            {topupBalance > 0 && <> · includes {topupBalance.toLocaleString()} top-up</>}
          </p>
          {!enforced && (
            <p className="mt-1.5 text-xs text-muted-foreground">Metering is live; usage isn&apos;t blocked yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function TopupPacksCard({ packs, loading, onPick, className }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-surface bg-background p-5 shadow-surface", className)}>
      <span className="text-xs font-medium text-muted-foreground">Top up credits</span>
      {loading
        ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[46px] w-full rounded-control" />)
        : packs.map((pack) => {
            const configured = !!pack.plan_id;
            return (
              <button
                key={pack.id}
                type="button"
                disabled={!configured}
                onClick={() => configured && onPick(pack)}
                className="group flex items-center justify-between gap-3 rounded-control border border-border px-3.5 py-2.5 text-left transition-[border-color,background-color,transform] duration-200 hover:border-primary hover:bg-primary-soft/50 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-control bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Zap className="size-3.5" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">{pack.credits.toLocaleString()} credits</span>
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
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
    <div className={cn("rounded-surface bg-background p-5 shadow-surface", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">AI usage · last 30 days</h2>
        {usage && (
          <span className="text-xs text-muted-foreground">
            {usage.total_questions.toLocaleString()} questions · {Math.round(usage.total_credits).toLocaleString()} credits
          </span>
        )}
      </div>

      {!usage ? (
        <Skeleton className="h-48 w-full rounded-control" />
      ) : usage.by_day.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">No AI usage yet in this window.</p>
      ) : (
        <>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usage.by_day} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(d) => d.slice(5)}
                  interval="preserveStartEnd"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} allowDecimals={false} width={44} axisLine={false} tickLine={false} />
                <RTooltip
                  cursor={{ fill: "var(--color-primary-soft)", radius: 8 }}
                  formatter={(v) => [`${Math.round(v)} credits`, "Used"]}
                  labelStyle={{ fontSize: 12, color: "var(--color-foreground)", fontWeight: 600 }}
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid var(--color-border)", boxShadow: "var(--shadow-floating)" }}
                />
                <Bar dataKey="credits" fill="var(--color-primary)" radius={[8, 8, 3, 3]} maxBarSize={26} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {Object.keys(usage.by_feature || {}).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(usage.by_feature).map(([feat, credits]) => (
                <span key={feat} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-body">
                  <span className="font-semibold text-foreground">{FEATURE_LABELS[feat] ?? feat}</span>
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
