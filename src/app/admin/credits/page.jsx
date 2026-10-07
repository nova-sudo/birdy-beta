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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Stagger, StaggerItem } from "@/components/motion";
import { useCreditsConfig, useCreditsAccounts, updateCreditsConfig, grantCredits } from "@/lib/admin-api";

const PLAN_STYLES = {
  Scale: "bg-pd-primary-tint text-pd-primary",
  Growth: "bg-pd-info-bg text-pd-info",
  Starter: "bg-pd-warning-bg text-pd-amber",
  Free: "bg-pd-divider text-pd-body",
};

const CARD = "rounded-xl border border-pd-border bg-pd-surface shadow-sm";
const TH = "bg-pd-table-head text-[11.5px] font-bold uppercase tracking-[.04em] text-pd-faint";
const TR = "border-b border-pd-row-border hover:bg-pd-table-head";

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
    <div className={`${CARD} p-5`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-pd-display text-sm font-bold text-pd-ink">Pricing controls</h3>
          <p className="text-xs text-pd-subtle mt-0.5">
            The markup is the profit multiplier and applies to <span className="font-medium">both</span> rates —
            Managed (real model cost) and Own-key (the 0.5/1k base). Takes effect on the next question, no redeploy.
          </p>
        </div>
        {config.updated_by && (
          <p className="text-[11px] text-pd-subtle">
            Last set by <span className="font-medium">{config.updated_by}</span> {relative(config.updated_at)}
          </p>
        )}
      </div>

      {/* Rate mode is no longer a choice: users do not bring their own key,
          so every question runs on Birdy's account and is billed at the
          managed rate. Shown, not switchable — CREDITS_RATE_MODE reverts it. */}
      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-[.04em] text-pd-faint mb-1.5">Active rate</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pd-primary-tint px-3 py-1.5 text-sm font-semibold text-pd-primary">
          <Sparkles className="h-3.5 w-3.5" /> Managed (real model cost)
        </span>
      </div>

      {/* Enforcement (the hard stopper) */}
      <div className={`mt-4 flex items-start justify-between gap-4 rounded-xl border p-4 transition-colors ${enforce ? "border-pd-danger-border bg-pd-danger-bg" : "border-pd-border bg-pd-canvas"}`}>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-pd-ink">
            <ShieldCheck className={`h-4 w-4 ${enforce ? "text-pd-danger" : "text-pd-faint"}`} />
            Enforce credit limits
          </p>
          <p className="mt-0.5 text-xs text-pd-subtle">
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
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/25 ${enforce ? "bg-pd-danger" : "bg-gray-300"}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${enforce ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {/* Markup dial — applies to both rates */}
      <div className="mt-4 rounded-xl border border-pd-primary-pale bg-pd-primary-tint p-4">
        <div className="flex items-center justify-between">
          <label htmlFor="markup" className="text-[11px] font-bold uppercase tracking-[.04em] text-pd-faint">
            Credit markup
          </label>
          <div className="flex items-center gap-1.5">
            <Input
              id="markup"
              type="number"
              step="0.5"
              min={min}
              max={max}
              value={markup}
              onChange={(e) => clampSet(e.target.value)}
              onBlur={(e) => { if (e.target.value === "") setMarkup(config.markup); }}
              className="w-20 text-right tabular-nums"
            />
            <span className="text-sm font-semibold text-pd-body">×</span>
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step="0.5"
          value={Number(markup) || min}
          onChange={(e) => setMarkup(Number(e.target.value))}
          className="mt-3 w-full accent-pd-primary"
          aria-label="Credit markup multiplier"
        />
        <div className="mt-1 flex justify-between text-[10px] text-pd-faint">
          <span>{min}×</span>
          <span>{max}×</span>
        </div>
      </div>

      {/* Price preview */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`rounded-xl border p-3 ${managedActive ? "border-pd-primary-pale bg-pd-surface" : "border-pd-border bg-pd-canvas opacity-70"}`}>
          <p className="flex items-center gap-1.5 text-xs font-medium text-pd-subtle">
            <Sparkles className="h-3.5 w-3.5 text-pd-primary" /> Managed · a typical question
          </p>
          <p className="mt-1 font-pd-display text-2xl font-extrabold text-pd-primary tabular-nums">
            {fmt(previewManaged, 1)} <span className="text-sm font-semibold text-pd-faint">credits</span>
          </p>
          <p className="text-[10px] text-pd-faint">
            {fmt(SAMPLE_IN)} in / {fmt(SAMPLE_OUT)} out on {config.model} · at {Number(markup) || 0}× markup
          </p>
        </div>
        <div className={`rounded-xl border p-3 ${!managedActive ? "border-pd-border-strong bg-pd-surface" : "border-pd-border bg-pd-canvas opacity-70"}`}>
          <p className="flex items-center gap-1.5 text-xs font-medium text-pd-subtle">
            <KeyRound className="h-3.5 w-3.5 text-pd-faint" /> Own-key · a typical question
          </p>
          <p className="mt-1 font-pd-display text-2xl font-extrabold text-pd-body tabular-nums">
            {fmt(previewByok, 1)} <span className="text-sm font-semibold text-pd-faint">credits</span>
          </p>
          <p className="text-[10px] text-pd-faint">0.5 credits / 1k tokens base · at {Number(markup) || 0}× markup</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[11px] text-pd-faint">
          <Info className="h-3.5 w-3.5" /> A credit is about one cent of AI value.
        </p>
        <Button
          type="button"
          onClick={save}
          disabled={!dirty || saving || markup === ""}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save pricing"}
        </Button>
      </div>
    </div>
  );
}

function PricingSkeleton() {
  return (
    <div className={`${CARD} p-5`}>
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-2 h-3 w-3/4" />
      <Skeleton className="mt-5 h-3 w-20" />
      <Skeleton className="mt-2 h-8 w-52 rounded-full" />
      <Skeleton className="mt-4 h-20 w-full" />
      <Skeleton className="mt-4 h-24 w-full" />
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="mt-4 flex justify-end">
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
    </div>
  );
}

function TotalCard({ Icon, label, value, tint, sub }) {
  return (
    <div className={`${CARD} p-4`}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.04em] text-pd-faint">
        <Icon className={`h-3.5 w-3.5 ${tint}`} /> {label}
      </p>
      <p className="mt-1 font-pd-display text-2xl font-extrabold text-pd-ink tabular-nums">{fmt(value)}</p>
      {sub && <p className="mt-0.5 text-[11px] text-pd-subtle">{sub}</p>}
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
      <DialogContent className="sm:max-w-sm rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-pd-display">Grant free credits</DialogTitle>
          <DialogDescription>{account.email} — outside of any Whop purchase.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="grant-amount" className="text-xs font-semibold text-pd-subtle">Amount</Label>
            <Input
              id="grant-amount"
              type="number" min={1} autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="grant-note" className="text-xs font-semibold text-pd-subtle">Note (optional)</Label>
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
          <Button
            type="button"
            onClick={submit}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {saving ? "Granting…" : "Grant credits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountsTable({ data, loading, onGrant }) {
  if (loading) {
    return (
      <div className={`${CARD} overflow-hidden`}>
        <Skeleton className="h-11 w-full rounded-none" />
        <div className="divide-y divide-pd-row-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              {Array.from({ length: 5 }).map((_, j) => <Skeleton key={j} className="h-3.5 w-12" />)}
            </div>
          ))}
        </div>
      </div>
    );
  }
  const rows = data?.accounts || [];
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-pd-border hover:bg-pd-table-head">
              <TableHead className={TH}>Account</TableHead>
              <TableHead className={TH}>Plan</TableHead>
              <TableHead className={`${TH} text-right`}>Balance</TableHead>
              <TableHead className={`${TH} text-right`}>Used · period</TableHead>
              <TableHead className={`${TH} text-right`}>Used · all-time</TableHead>
              <TableHead className={`${TH} text-right`}>Bought</TableHead>
              <TableHead className={`${TH} text-right`}>Granted</TableHead>
              <TableHead className={`${TH} text-right`}>Questions</TableHead>
              <TableHead className={TH}>Last used</TableHead>
              <TableHead className={`${TH} w-10`} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow className={TR}>
                <TableCell colSpan={10} className="text-center text-sm text-pd-subtle py-10">
                  No accounts found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((a) => (
              <TableRow key={a.email} className={`group ${TR}`}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-pd-primary-tint text-pd-primary text-[11px] font-bold flex items-center justify-center">
                      {initials(a.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-pd-ink truncate">{a.name}</div>
                      <div className="text-xs text-pd-subtle truncate">{a.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`text-[11px] font-bold ${PLAN_STYLES[a.plan] || PLAN_STYLES.Free}`}>{a.plan}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm font-semibold text-pd-ink">
                  {fmt(a.balance)}
                  {a.topup_balance > 0 && (
                    <span className="block text-[10px] font-normal text-pd-success">+{fmt(a.topup_balance)} top-up</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-pd-body">
                  {fmt(a.used_period)}{a.allowance > 0 && <span className="text-pd-faint"> / {fmt(a.allowance)}</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-pd-body">
                  {fmt(a.used_total)}
                  {a.used_total > 0 && (
                    <span className="block text-[10px] font-normal text-pd-faint">
                      {fmt(a.used_internal)} app · {fmt(a.used_slack)} slack · {fmt(a.used_cron)} cron
                    </span>
                  )}
                  {a.used_call_analysis > 0 && (
                    <span className="block text-[10px] font-normal text-pd-amber">
                      {fmt(a.used_call_analysis)} call AI · {fmt(a.audio_minutes)} min audio
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  <span className={a.purchased_total > 0 ? "font-semibold text-pd-success" : "text-pd-faint"}>
                    {fmt(a.purchased_total)}
                  </span>
                  {a.topups > 0 && <span className="block text-[10px] text-pd-faint">{a.topups} order{a.topups > 1 ? "s" : ""}</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  <span className={a.granted_total > 0 ? "font-semibold text-pd-primary" : "text-pd-faint"}>
                    {fmt(a.granted_total)}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-pd-body">{fmt(a.questions)}</TableCell>
                <TableCell className="text-xs text-pd-subtle whitespace-nowrap">{relative(a.last_used)}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onGrant(a)}
                    aria-label={`Grant credits to ${a.email}`}
                    title="Grant free credits"
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-pd-faint"
                  >
                    <Gift className="h-4 w-4" />
                  </Button>
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
        <h2 className="font-pd-display text-xl font-bold text-pd-ink flex items-center gap-2">
          <Coins className="h-5 w-5 text-pd-primary" /> Birdy Credits
        </h2>
        <p className="text-sm text-pd-subtle">
          Control the credit markup and rate, and see every account&apos;s balance, usage, and purchases.
        </p>
      </div>

      {configLoading || !config ? (
        <PricingSkeleton />
      ) : (
        <PricingControls config={config} mutate={mutateConfig} />
      )}

      {/* Platform totals */}
      <Stagger gap={0.05} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StaggerItem>
          <TotalCard Icon={Wallet} tint="text-pd-success" label="Outstanding balance" value={totals.balance} />
        </StaggerItem>
        <StaggerItem>
          <TotalCard
            Icon={TrendingUp}
            tint="text-pd-primary"
            label="Credits used · all-time"
            value={totals.used_total}
            sub={totals.used_total > 0
              ? `${fmt(totals.used_internal)} app · ${fmt(totals.used_slack)} slack · ${fmt(totals.used_cron)} cron`
              : null}
          />
        </StaggerItem>
        <StaggerItem>
          <TotalCard
            Icon={Phone}
            tint="text-pd-amber"
            label="Call analysis · all-time"
            value={totals.used_call_analysis}
            sub={totals.audio_minutes > 0
              ? `${fmt(totals.audio_minutes)} min of recordings transcribed`
              : "No calls analyzed yet"}
          />
        </StaggerItem>
        <StaggerItem>
          <TotalCard Icon={ShoppingCart} tint="text-pd-info" label="Credits bought · all-time" value={totals.purchased_total} />
        </StaggerItem>
      </Stagger>

      {/* Accounts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-pd-display text-sm font-bold text-pd-ink">
          Accounts {accounts?.total ? <span className="font-normal text-pd-subtle">({fmt(accounts.total)})</span> : null}
        </h3>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-faint" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search accounts…"
            aria-label="Search accounts"
            className="pl-9"
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
