"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap, Loader2, Check,
} from "lucide-react";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useCredits } from "@/hooks/useCredits";

const WHOP_ENVIRONMENT =
  (process.env.NEXT_PUBLIC_WHOP_ENVIRONMENT ?? "production") === "sandbox" ? "sandbox" : "production";

const FEATURE_LABELS = { ask_birdy: "Ask Birdy", suggestions: "Suggestions" };

function getStoredEmail() {
  if (typeof window === "undefined") return "";
  try {
    return JSON.parse(localStorage.getItem("user"))?.email ?? "";
  } catch {
    return "";
  }
}

// Top-up checkout in a modal (mirrors the billing page's Whop embed).
function TopupModal({ pack, email, onClose, onComplete }) {
  const [appliedPromo, setAppliedPromo] = useState(null);
  const returnUrl =
    typeof window !== "undefined" ? `${window.location.origin}/credits?topup=success` : undefined;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 border-b border-gray-100 text-left">
          <DialogTitle>{pack.credits.toLocaleString()} Birdy Credits</DialogTitle>
          <DialogDescription>${pack.price} · Secure checkout powered by Whop</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {appliedPromo && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
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
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// The balance and the packs land from two different requests, so the row
// would otherwise assemble itself card by card in front of the reader. These
// hold its shape until each half arrives.
function BalanceSkeleton() {
  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white p-5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-9 w-24" />
      <Skeleton className="mt-2 h-3 w-36" />
    </div>
  );
}

function PackSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-1.5 h-3 w-10" />
        </div>
      </div>
      <Skeleton className="mt-4 h-10 w-full rounded-xl" />
    </div>
  );
}

/**
 * Everything on the Credits page below its heading.
 *
 * Extracted so the Settings Billing tab can show the same balance, packs and
 * usage chart the design asks for without a second copy — the tab and the
 * standalone page are the same panel with a different frame around it.
 */
export function CreditsPanel() {
  const { status, loading: statusLoading, refresh } = useCredits();
  const [usage, setUsage] = useState(null);
  const [packs, setPacks] = useState([]);
  // First load only — the post-top-up refetches below re-run loadUsage, and
  // swapping loaded cards back to skeletons would read as a glitch.
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
      // non-fatal
    } finally {
      setPacksLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsage(); }, [loadUsage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") === "success") {
      setSuccessMsg("🎉 Credits added! Your new balance is on the way.");
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => { void refresh(); void loadUsage(); }, 2000);
      setTimeout(() => { void refresh(); void loadUsage(); }, 5000);
    }
  }, [refresh, loadUsage]);

  const handleTopupComplete = () => {
    setCheckoutPack(null);
    setSuccessMsg("🎉 Credits added! Your new balance is on the way.");
    setTimeout(() => { void refresh(); void loadUsage(); }, 2000);
    setTimeout(() => { void refresh(); void loadUsage(); }, 5000);
  };

  const s = status || {};
  const balance = s.balance ?? 0;
  const topup = s.topup_balance ?? 0;
  const isOut = !!s.out;
  const low = !!s.low;
  const enforced = !!s.enforced;

  // The backend still serves a 10,000-credit pack; the design only offers the
  // three smaller ones, so the big pack is filtered out here rather than
  // pulled from the API (other surfaces may still want it).
  const visiblePacks = packs.filter((pack) => pack.credits < 10_000);

  const tone = isOut ? "red" : low ? "amber" : "emerald";
  const toneText = { red: "text-red-600", amber: "text-amber-600", emerald: "text-emerald-600" }[tone];

  // The panel used to withhold everything behind one centred spinner. It now
  // draws its own layout straight away and fills each card in as its request
  // lands, so nothing below the row jumps once the balance arrives.
  const balancePending = statusLoading && !status;

  return (
    <div className="w-full">

      {successMsg && (
        <div className="mb-5 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700">
          <Check className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{successMsg}</p>
          <button type="button" onClick={() => setSuccessMsg(null)} className="ml-auto text-green-400 hover:text-green-600">✕</button>
        </div>
      )}

      {/* Balance and the packs that top it up, on one row — the balance reads
          as the first card in the same strip rather than a separate hero, so
          "how many left" and "buy more" sit side by side. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Balance */}
        {balancePending ? (
          <BalanceSkeleton />
        ) : (
          <div className={`rounded-2xl border-2 p-5 ${isOut ? "border-red-200 bg-red-50" : low ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className="text-xs font-medium text-gray-500">Credits left</p>
            <p className={`mt-1 text-4xl font-extrabold ${toneText}`}>{balance.toLocaleString()}</p>
            <p className="mt-1 text-xs text-gray-500">
              {topup > 0 && <>includes {topup.toLocaleString()} top-up · </>}
              {isOut ? "Out of credits" : low ? "Running low" : "Available now"}
            </p>
            {!enforced && (
              <p className="mt-2 text-[11px] text-gray-400">
                Metering is live; usage isn&apos;t blocked yet.
              </p>
            )}
          </div>
        )}

        {/* Top-up packs. Three skeletons, because that's how many the design
            offers — see the pack filter above. */}
        {packsLoading && [0, 1, 2].map((i) => <PackSkeleton key={i} />)}

        {!packsLoading && visiblePacks.map((pack) => {
          const configured = !!pack.plan_id;
          return (
            <div key={pack.id} className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{pack.credits.toLocaleString()} credits</p>
                  <p className="text-xs text-gray-500">${pack.price}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={!configured}
                onClick={() => configured && setCheckoutPack(pack)}
                className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {configured ? "Add credits" : "Coming soon"}
              </button>
            </div>
          );
        })}
      </div>

      {visiblePacks.some((p) => !p.plan_id) && (
        <p className="-mt-4 mb-6 text-xs text-gray-400">
          Top-up packs activate once their Whop plans are configured.
        </p>
      )}

      {/* Usage breakdown */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Usage — last 30 days</h2>
          {usage && (
            <span className="text-xs text-gray-500">
              {usage.total_questions.toLocaleString()} questions · {Math.round(usage.total_credits).toLocaleString()} credits
            </span>
          )}
        </div>

        {!usage ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
          </div>
        ) : usage.by_day.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No AI usage yet in this window.</p>
        ) : (
          <>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usage.by_day} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickFormatter={(d) => d.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} width={40} />
                  <RTooltip
                    formatter={(v) => [`${Math.round(v)} credits`, "Used"]}
                    labelStyle={{ fontSize: 12 }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="credits" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {Object.keys(usage.by_feature || {}).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(usage.by_feature).map(([feat, credits]) => (
                  <span key={feat} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-3 py-1 text-xs text-gray-600">
                    <span className="font-medium text-gray-800">{FEATURE_LABELS[feat] ?? feat}</span>
                    {Math.round(credits).toLocaleString()} credits
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {checkoutPack && (
        <TopupModal
          pack={checkoutPack}
          email={storedEmail}
          onClose={() => setCheckoutPack(null)}
          onComplete={handleTopupComplete}
        />
      )}
    </div>
  );
}
