"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search, Coins, Sparkles, KeyRound, Loader2, Save, Info, TrendingUp, Wallet, ShoppingCart, ShieldCheck, Gift, Phone,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useCreditsConfig, useCreditsAccounts, updateCreditsConfig, grantCredits } from "@/lib/admin-api";

const PLAN_STYLES = {
  Scale: "bg-purple-50 text-purple-700 border-purple-200",
  Growth: "bg-blue-50 text-blue-700 border-blue-200",
  Starter: "bg-amber-50 text-amber-700 border-amber-200",
  Free: "bg-gray-50 text-gray-600 border-gray-200",
};

// Illustrative token profile for the "per question" price preview. The markup
// scales this linearly, so it's an honest way to feel 2× vs 5× at a glance.
const SAMPLE_IN = 3000;
const SAMPLE_OUT = 1000;

const fmt = (n, d = 0) =>
  Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d });

function relative(ts) {
  if (!ts) return "—";
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return "—"; }
}

function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

// ── Pricing controls: markup dial + rate mode, with a live price preview ─────
function PricingControls({ config, mutate }) {
  const [markup, setMarkup] = useState(config.markup);
  // Fixed at managed; the own-key rate has no meaning now that BYOK is gone.
  const rateMode = "managed";
  const [enforce, setEnforce] = useState(config.enforce);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // No setRateMode: the rate is fixed at "managed" (BYOK is gone) — the
    // stale setter call here crashed the whole page the moment config loaded.
    setMarkup(config.markup);
    setEnforce(config.enforce);
  }, [config.markup, config.enforce]);

  const min = config.markup_min ?? 1;
  const max = config.markup_max ?? 20;
  const dirty = Number(markup) !== config.markup || rateMode !== config.rate_mode || enforce !== config.enforce;

  const pricing = config.model_pricing || { in: 0, out: 0 };
  const previewManaged = useMemo(() => {
    const costCents = ((SAMPLE_IN * pricing.in + SAMPLE_OUT * pricing.out) / 1e6) * 100;
    return costCents * (Number(markup) || 0);
  }, [pricing.in, pricing.out, markup]);
  const previewByok = ((0.5 * (SAMPLE_IN + SAMPLE_OUT)) / 1000) * (Number(markup) || 0);

  const managedActive = rateMode === "managed";

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateCreditsConfig({ markup: Number(markup), rate_mode: rateMode, enforce });
      await mutate(updated, { revalidate: false });
      toast.success("Credits settings updated", {
        description: `Markup ${updated.markup}× · ${updated.rate_mode === "managed" ? "Managed" : "Own-key"} · stopper ${updated.enforce ? "ON" : "off"}`,
      });
    } catch (e) {
      toast.error("Couldn't update pricing", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const clampSet = (v) => {
    if (v === "" ) { setMarkup(""); return; }
    const n = Number(v);
    if (Number.isNaN(n)) return;
    setMarkup(Math.min(max, Math.max(min, n)));
  };

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-[#1F1B33]">Pricing controls</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            The markup is the profit multiplier and applies to <span className="font-medium">both</span> rates —
            Managed (real model cost) and Own-key (the 0.5/1k base). Takes effect on the next question, no redeploy.
          </p>
        </div>
        {config.updated_by && (
          <p className="text-[11px] text-muted-foreground">
            Last set by <span className="font-medium">{config.updated_by}</span> {relative(config.updated_at)}
          </p>
        )}
      </div>

      {/* Rate mode is no longer a choice: users do not bring their own key,
          so every question runs on Birdy's account and is billed at the
          managed rate. Shown, not switchable — CREDITS_RATE_MODE reverts it. */}
      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B] mb-1.5">Active rate</p>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700">
          <Sparkles className="h-3.5 w-3.5" /> Managed (real model cost)
        </span>
      </div>

      {/* Enforcement (the hard stopper) */}
      <div className={`mt-4 flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors ${enforce ? "border-red-200 bg-red-50/50" : "border-gray-200 bg-gray-50/60"}`}>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#1F1B33]">
            <ShieldCheck className={`h-4 w-4 ${enforce ? "text-red-600" : "text-gray-400"}`} />
            Enforce credit limits
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {enforce
              ? "ON — out-of-credits accounts are blocked in the app, Slack, and the weekly cron."
              : "Off — usage is metered and shown, but AI keeps working after credits run out."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enforce}
          onClick={() => setEnforce((v) => !v)}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enforce ? "bg-red-500" : "bg-gray-300"}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enforce ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {/* Markup dial — applies to both rates */}
      <div className="mt-4 rounded-lg border border-purple-100 bg-purple-50/40 p-4">
        <div className="flex items-center justify-between">
          <label htmlFor="markup" className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">
            Credit markup
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="markup"
              type="number"
              step="0.5"
              min={min}
              max={max}
              value={markup}
              onChange={(e) => clampSet(e.target.value)}
              onBlur={(e) => { if (e.target.value === "") setMarkup(config.markup); }}
              className="w-20 rounded-md border border-input bg-white px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <span className="text-sm font-semibold text-gray-700">×</span>
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step="0.5"
          value={Number(markup) || min}
          onChange={(e) => setMarkup(Number(e.target.value))}
          className="mt-3 w-full accent-purple-600"
          aria-label="Credit markup multiplier"
        />
        <div className="mt-1 flex justify-between text-[10px] text-gray-400">
          <span>{min}×</span>
          <span>{max}×</span>
        </div>
      </div>

      {/* Price preview */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`rounded-lg border p-3 ${managedActive ? "border-purple-200 bg-white" : "border-gray-100 bg-gray-50/60 opacity-70"}`}>
          <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <Sparkles className="h-3.5 w-3.5 text-purple-500" /> Managed · a typical question
          </p>
          <p className="mt-1 text-2xl font-extrabold text-purple-700 tabular-nums">
            {fmt(previewManaged, 1)} <span className="text-sm font-semibold text-gray-400">credits</span>
          </p>
          <p className="text-[10px] text-gray-400">
            {fmt(SAMPLE_IN)} in / {fmt(SAMPLE_OUT)} out on {config.model} · at {Number(markup) || 0}× markup
          </p>
        </div>
        <div className={`rounded-lg border p-3 ${!managedActive ? "border-gray-300 bg-white" : "border-gray-100 bg-gray-50/60 opacity-70"}`}>
          <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <KeyRound className="h-3.5 w-3.5 text-gray-400" /> Own-key · a typical question
          </p>
          <p className="mt-1 text-2xl font-extrabold text-gray-700 tabular-nums">
            {fmt(previewByok, 1)} <span className="text-sm font-semibold text-gray-400">credits</span>
          </p>
          <p className="text-[10px] text-gray-400">0.5 credits / 1k tokens base · at {Number(markup) || 0}× markup</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <Info className="h-3.5 w-3.5" /> A credit is about one cent of AI value.
        </p>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || markup === ""}
          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save pricing"}
        </button>
      </div>
    </div>
  );
}

function TotalCard({ Icon, label, value, tint, sub }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">
        <Icon className={`h-3.5 w-3.5 ${tint}`} /> {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold text-[#1F1B33] tabular-nums">{fmt(value)}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

function GrantCreditsDialog({ account, onClose, onGranted }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Enter a positive amount");
    setSaving(true);
    try {
      await grantCredits({ email: account.email, amount: n, note: note.trim() || undefined });
      toast.success(`Granted ${fmt(n)} credits to ${account.email}`);
      onGranted();
    } catch (e) {
      toast.error("Couldn't grant credits", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Grant free credits</DialogTitle>
          <DialogDescription>{account.email} — outside of any Whop purchase.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="grant-amount" className="text-xs font-semibold text-[#71658B]">Amount</Label>
            <Input
              id="grant-amount"
              type="number" min={1} autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="grant-note" className="text-xs font-semibold text-[#71658B]">Note (optional)</Label>
            <Input
              id="grant-note"
              placeholder="e.g. goodwill credit, support escalation"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {saving ? "Granting…" : "Grant credits"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountsTable({ data, loading, onGrant }) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-xl border bg-white p-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }
  const rows = data?.accounts || [];
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">Account</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">Plan</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B] text-right">Balance</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B] text-right">Used · period</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B] text-right">Used · all-time</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B] text-right">Bought</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B] text-right">Granted</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B] text-right">Questions</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">Last used</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-10">
                  No accounts found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((a) => (
              <TableRow key={a.email} className="group">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold flex items-center justify-center">
                      {initials(a.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={PLAN_STYLES[a.plan] || PLAN_STYLES.Free}>{a.plan}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm font-semibold text-gray-900">
                  {fmt(a.balance)}
                  {a.topup_balance > 0 && (
                    <span className="block text-[10px] font-normal text-emerald-600">+{fmt(a.topup_balance)} top-up</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-gray-600">
                  {fmt(a.used_period)}{a.allowance > 0 && <span className="text-gray-400"> / {fmt(a.allowance)}</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-gray-600">
                  {fmt(a.used_total)}
                  {a.used_total > 0 && (
                    <span className="block text-[10px] font-normal text-gray-400">
                      {fmt(a.used_internal)} app · {fmt(a.used_slack)} slack · {fmt(a.used_cron)} cron
                    </span>
                  )}
                  {a.used_call_analysis > 0 && (
                    <span className="block text-[10px] font-normal text-amber-600">
                      {fmt(a.used_call_analysis)} call AI · {fmt(a.audio_minutes)} min audio
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  <span className={a.purchased_total > 0 ? "font-semibold text-emerald-700" : "text-gray-400"}>
                    {fmt(a.purchased_total)}
                  </span>
                  {a.topups > 0 && <span className="block text-[10px] text-gray-400">{a.topups} order{a.topups > 1 ? "s" : ""}</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  <span className={a.granted_total > 0 ? "font-semibold text-purple-700" : "text-gray-400"}>
                    {fmt(a.granted_total)}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-gray-600">{fmt(a.questions)}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{relative(a.last_used)}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onGrant(a)}
                    aria-label={`Grant credits to ${a.email}`}
                    title="Grant free credits"
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-purple-600 transition-opacity"
                  >
                    <Gift className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function AdminCreditsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: config, isLoading: configLoading, mutate: mutateConfig } = useCreditsConfig();
  const { data: accounts, isLoading: accountsLoading, mutate: mutateAccounts } = useCreditsAccounts(search);
  const totals = accounts?.totals || {};
  const [grantAccount, setGrantAccount] = useState(null);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-[#1F1B33] flex items-center gap-2">
          <Coins className="h-5 w-5 text-purple-600" /> Birdy Credits
        </h2>
        <p className="text-sm text-muted-foreground">
          Control the credit markup and rate, and see every account&apos;s balance, usage, and purchases.
        </p>
      </div>

      {configLoading || !config ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : (
        <PricingControls config={config} mutate={mutateConfig} />
      )}

      {/* Platform totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TotalCard Icon={Wallet} tint="text-emerald-500" label="Outstanding balance" value={totals.balance} />
        <TotalCard
          Icon={TrendingUp}
          tint="text-purple-500"
          label="Credits used · all-time"
          value={totals.used_total}
          sub={totals.used_total > 0
            ? `${fmt(totals.used_internal)} app · ${fmt(totals.used_slack)} slack · ${fmt(totals.used_cron)} cron`
            : null}
        />
        <TotalCard
          Icon={Phone}
          tint="text-amber-500"
          label="Call analysis · all-time"
          value={totals.used_call_analysis}
          sub={totals.audio_minutes > 0
            ? `${fmt(totals.audio_minutes)} min of recordings transcribed`
            : "No calls analyzed yet"}
        />
        <TotalCard Icon={ShoppingCart} tint="text-blue-500" label="Credits bought · all-time" value={totals.purchased_total} />
      </div>

      {/* Accounts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-[#1F1B33]">
          Accounts {accounts?.total ? <span className="font-normal text-muted-foreground">({fmt(accounts.total)})</span> : null}
        </h3>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search accounts…"
            aria-label="Search accounts"
            className="h-9 w-full rounded-full border border-input bg-white pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
      </div>

      <AccountsTable data={accounts} loading={accountsLoading} onGrant={setGrantAccount} />

      {grantAccount && (
        <GrantCreditsDialog
          account={grantAccount}
          onClose={() => setGrantAccount(null)}
          onGranted={() => { setGrantAccount(null); void mutateAccounts(); }}
        />
      )}
    </div>
  );
}
