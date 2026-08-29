"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap, AlertCircle, Loader2, Check, Sparkles, KeyRound,
} from "lucide-react";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
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
  const allowance = s.allowance ?? 0;
  const used = s.used ?? 0;
  const topup = s.topup_balance ?? 0;
  const isOut = !!s.out;
  const low = !!s.low;
  const enforced = !!s.enforced;
  const rateMode = s.rate_mode ?? "byok";
  const usedPct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;

  const tone = isOut ? "red" : low ? "amber" : "emerald";
  const toneText = { red: "text-red-600", amber: "text-amber-600", emerald: "text-emerald-600" }[tone];
  const toneBar = { red: "bg-red-500", amber: "bg-amber-500", emerald: "bg-emerald-500" }[tone];

  if (statusLoading && !status) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full">

      {successMsg && (
        <div className="mb-5 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700">
          <Check className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{successMsg}</p>
          <button type="button" onClick={() => setSuccessMsg(null)} className="ml-auto text-green-400 hover:text-green-600">✕</button>
        </div>
      )}

      {/* Balance + allowance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Balance hero */}
        <div className={`md:col-span-1 rounded-2xl border-2 p-5 ${isOut ? "border-red-200 bg-red-50" : low ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
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

        {/* Allowance usage */}
        <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">This period&apos;s allowance</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
              {rateMode === "managed"
                ? <><Sparkles className="w-3.5 h-3.5 text-purple-500" /> Managed rate</>
                : <><KeyRound className="w-3.5 h-3.5 text-gray-400" /> Own-key rate</>}
            </span>
          </div>
          {allowance > 0 ? (
            <>
              <div className="mt-3 flex items-baseline justify-between text-sm">
                <span className="text-gray-500">Used</span>
                <span className="font-medium text-gray-700">
                  {Math.round(used).toLocaleString()} / {allowance.toLocaleString()}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${toneBar}`} style={{ width: `${usedPct}%` }} />
              </div>
              {s.current_period_end && (
                <p className="mt-2 text-xs text-gray-400">
                  Resets {new Date(s.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
            </>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-3 text-sm text-gray-600">
              <AlertCircle className="w-4 h-4 shrink-0 text-gray-400" />
              No plan allowance.{" "}
              <a href="/billing" className="font-medium text-purple-600 underline underline-offset-2">Subscribe</a>{" "}
              for monthly credits, or top up below.
            </div>
          )}
        </div>
      </div>

      {/* Top-up packs */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Buy more credits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {packs.map((pack) => {
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
                  {configured ? "Buy" : "Coming soon"}
                </button>
              </div>
            );
          })}
        </div>
        {packs.some((p) => !p.plan_id) && (
          <p className="mt-2 text-xs text-gray-400">
            Top-up packs activate once their Whop plans are configured.
          </p>
        )}
      </div>

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
