"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Sparkles, KeyRound, Save, Info, Gift } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  DataTable,
  DataTableColumnHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  Label,
  MetricGroup,
  Notice,
  Skeleton,
  Surface,
  Switch,
  TwoLineCell,
} from "@/components/ds";
import AdminHeader from "@/components/admin/AdminHeader";
import { planTone, relative } from "@/components/admin/format";
import {
  useCreditsConfig, useCreditsAccounts, updateCreditsConfig, grantCredits,
} from "@/lib/admin-api";

// Illustrative token profile for the "per question" price preview. The markup
// scales this linearly, so it's an honest way to feel 2× vs 5× at a glance.
const SAMPLE_IN = 3000;
const SAMPLE_OUT = 1000;

const fmt = (n, d = 0) =>
  Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d });

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
    <Surface className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Pricing controls</h3>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            The markup is the profit multiplier and applies to <span className="font-medium">both</span> rates —
            Managed (real model cost) and Own-key (the 0.5/1k base). Takes effect on the next question, no redeploy.
          </p>
        </div>
        {config.updated_by && (
          <p className="text-xs text-muted-foreground">
            Last set by <span className="font-medium">{config.updated_by}</span> {relative(config.updated_at)}
          </p>
        )}
      </div>

      {/* Rate mode is no longer a choice: users do not bring their own key,
          so every question runs on Birdy's account and is billed at the
          managed rate. Shown, not switchable — CREDITS_RATE_MODE reverts it. */}
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-foreground">Active rate</p>
        <Badge tone="primary" className="h-7 gap-1.5 px-3 text-sm">
          <Sparkles aria-hidden /> Managed (real model cost)
        </Badge>
      </div>

      {/* Enforcement (the hard stopper) */}
      {/* role="group": Notice defaults to a live region, and a toggle inside one
          would re-announce itself every time it flips. */}
      <Notice
        role="group"
        aria-label="Credit enforcement"
        tone={enforce ? "danger" : "neutral"}
        title="Enforce credit limits"
        className="items-start gap-4 p-4"
        action={
          <Switch
            checked={enforce}
            onCheckedChange={setEnforce}
            aria-label="Enforce credit limits"
            className="mt-0.5"
          />
        }
      >
        {enforce
          ? "ON — out-of-credits accounts are blocked in the app, Slack, and the weekly cron."
          : "Off — usage is metered and shown, but AI keeps working after credits run out."}
      </Notice>

      {/* Markup dial — applies to both rates */}
      <div className="rounded-control bg-primary-soft p-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="markup">Credit markup</Label>
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
              className="num w-20 text-right"
            />
            <span className="text-sm font-semibold text-body">×</span>
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step="0.5"
          value={Number(markup) || min}
          onChange={(e) => setMarkup(Number(e.target.value))}
          className="mt-3 w-full accent-primary"
          aria-label="Credit markup multiplier"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{min}×</span>
          <span>{max}×</span>
        </div>
      </div>

      {/* Price preview */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={`rounded-control p-3 ${managedActive ? "bg-background shadow-control" : "bg-muted opacity-70"}`}>
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Sparkles aria-hidden className="size-3.5 text-primary" /> Managed · a typical question
          </p>
          <p className="num mt-1 text-2xl font-semibold text-primary">
            {fmt(previewManaged, 1)} <span className="text-sm font-medium text-muted-foreground">credits</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {fmt(SAMPLE_IN)} in / {fmt(SAMPLE_OUT)} out on {config.model} · at {Number(markup) || 0}× markup
          </p>
        </div>
        <div className={`rounded-control p-3 ${!managedActive ? "bg-background shadow-control" : "bg-muted opacity-70"}`}>
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <KeyRound aria-hidden className="size-3.5" /> Own-key · a typical question
          </p>
          <p className="num mt-1 text-2xl font-semibold text-body">
            {fmt(previewByok, 1)} <span className="text-sm font-medium text-muted-foreground">credits</span>
          </p>
          <p className="text-xs text-muted-foreground">0.5 credits / 1k tokens base · at {Number(markup) || 0}× markup</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info aria-hidden className="size-3.5" /> A credit is about one cent of AI value.
        </p>
        <Button
          type="button"
          variant="primary"
          onClick={save}
          loading={saving}
          disabled={!dirty || markup === ""}
        >
          <Save aria-hidden />
          {saving ? "Saving…" : "Save pricing"}
        </Button>
      </div>
    </Surface>
  );
}

function PricingSkeleton() {
  return (
    <Surface className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-4 w-3/4" />
      </div>
      <Skeleton className="h-7 w-52" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-control w-32" />
      </div>
    </Surface>
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
          <div className="space-y-1.5">
            <Label htmlFor="grant-amount">Amount</Label>
            <Input
              id="grant-amount"
              type="number" min={1} autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grant-note">Note (optional)</Label>
            <Input
              id="grant-note"
              placeholder="e.g. goodwill credit, support escalation"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="primary" onClick={submit} loading={saving}>
            <Gift aria-hidden />
            {saving ? "Granting…" : "Grant credits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Right-aligned, sortable header for a number column.
const numHeader = (title) =>
  function NumHeader({ column }) {
    return <DataTableColumnHeader column={column} title={title} align="right" />;
  };

const subLine = (tone, children) => (
  <span className={`block text-xs font-normal ${tone}`}>{children}</span>
);

function AccountsTable({ data, loading, onGrant, toolbar }) {
  const rows = useMemo(() => data?.accounts || [], [data]);

  const columns = useMemo(
    () => [
      {
        id: "account",
        accessorFn: (a) => a.name,
        header: "Account",
        meta: { label: "Account", minWidth: 220 },
        cell: ({ row }) => <TwoLineCell primary={row.original.name} secondary={row.original.email} />,
      },
      {
        accessorKey: "plan",
        header: "Plan",
        meta: { label: "Plan" },
        cell: ({ row }) => <Badge tone={planTone(row.original.plan)}>{row.original.plan}</Badge>,
      },
      {
        id: "balance",
        accessorFn: (a) => a.balance,
        header: numHeader("Balance"),
        meta: { label: "Balance" },
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="num text-right text-sm font-medium text-foreground">
              {/* An empty balance is what the enforcement stopper acts on, so it is the one number worth a colour. */}
              {a.balance === 0 ? <Badge tone="danger">0</Badge> : fmt(a.balance)}
              {a.topup_balance > 0 && subLine("text-success-ink", `+${fmt(a.topup_balance)} top-up`)}
            </div>
          );
        },
      },
      {
        id: "used_period",
        accessorFn: (a) => a.used_period,
        header: numHeader("Used · period"),
        meta: { label: "Used · period" },
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="num text-right text-sm text-body">
              {fmt(a.used_period)}
              {a.allowance > 0 && <span className="text-muted-foreground"> / {fmt(a.allowance)}</span>}
            </div>
          );
        },
      },
      {
        id: "used_total",
        accessorFn: (a) => a.used_total,
        header: numHeader("Used · all-time"),
        meta: { label: "Used · all-time" },
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="num text-right text-sm text-body">
              {fmt(a.used_total)}
              {a.used_total > 0 &&
                subLine("text-muted-foreground", `${fmt(a.used_internal)} app · ${fmt(a.used_slack)} slack · ${fmt(a.used_cron)} cron`)}
              {a.used_call_analysis > 0 &&
                subLine("text-warning-ink", `${fmt(a.used_call_analysis)} call AI · ${fmt(a.audio_minutes)} min audio`)}
            </div>
          );
        },
      },
      {
        id: "purchased_total",
        accessorFn: (a) => a.purchased_total,
        header: numHeader("Bought"),
        meta: { label: "Bought" },
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="num text-right text-sm">
              <span className={a.purchased_total > 0 ? "font-medium text-success-ink" : "text-muted-foreground"}>
                {fmt(a.purchased_total)}
              </span>
              {a.topups > 0 && subLine("text-muted-foreground", `${a.topups} order${a.topups > 1 ? "s" : ""}`)}
            </div>
          );
        },
      },
      {
        id: "granted_total",
        accessorFn: (a) => a.granted_total,
        header: numHeader("Granted"),
        meta: { label: "Granted" },
        cell: ({ row }) => (
          <div className="num text-right text-sm">
            <span className={row.original.granted_total > 0 ? "font-medium text-primary" : "text-muted-foreground"}>
              {fmt(row.original.granted_total)}
            </span>
          </div>
        ),
      },
      {
        id: "questions",
        accessorFn: (a) => a.questions,
        header: numHeader("Questions"),
        meta: { label: "Questions" },
        cell: ({ row }) => <div className="num text-right text-sm text-body">{fmt(row.original.questions)}</div>,
      },
      {
        id: "last_used",
        accessorFn: (a) => (a.last_used ? new Date(a.last_used).getTime() : 0),
        header: "Last used",
        meta: { label: "Last used" },
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{relative(row.original.last_used)}</span>,
      },
      {
        id: "grant",
        header: () => <span className="sr-only">Grant</span>,
        enableSorting: false,
        enableHiding: false,
        meta: { label: "Grant" },
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onGrant(row.original)}
            aria-label={`Grant credits to ${row.original.email}`}
            title="Grant free credits"
            className="text-muted-foreground"
          >
            <Gift aria-hidden />
          </Button>
        ),
      },
    ],
    [onGrant]
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      toolbar={toolbar}
      getRowId={(a) => a.email}
      empty={<EmptyState title="No accounts found." />}
    />
  );
}

export default function AdminCreditsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const {
    data: config, error: configError, isLoading: configLoading, mutate: mutateConfig,
  } = useCreditsConfig();
  const {
    data: accounts, error: accountsError, isLoading: accountsLoading, mutate: mutateAccounts,
  } = useCreditsAccounts(search);
  const totals = accounts?.totals || {};
  const [grantAccount, setGrantAccount] = useState(null);

  return (
    <div className="flex flex-col gap-5">
      <AdminHeader
        title="Birdy Credits"
        description="Control the credit markup and rate, and see every account's balance, usage, and purchases."
      />

      {configError && !config ? (
        <Surface>
          <ErrorState title="Couldn't load pricing controls" onRetry={() => mutateConfig()} />
        </Surface>
      ) : configLoading || !config ? (
        <PricingSkeleton />
      ) : (
        <PricingControls config={config} mutate={mutateConfig} />
      )}

      {/* Platform totals */}
      <MetricGroup
        title="Platform totals"
        items={[
          { key: "balance", label: "Outstanding balance", value: fmt(totals.balance) },
          {
            key: "used",
            label: "Credits used · all-time",
            value: fmt(totals.used_total),
            caption: totals.used_total > 0
              ? `${fmt(totals.used_internal)} app · ${fmt(totals.used_slack)} slack · ${fmt(totals.used_cron)} cron`
              : undefined,
          },
          {
            key: "calls",
            label: "Call analysis · all-time",
            value: fmt(totals.used_call_analysis),
            caption: totals.audio_minutes > 0
              ? `${fmt(totals.audio_minutes)} min of recordings transcribed`
              : "No calls analyzed yet",
          },
          { key: "bought", label: "Credits bought · all-time", value: fmt(totals.purchased_total) },
        ]}
      />

      {/* Accounts */}
      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-base font-semibold text-foreground">
          Accounts {accounts?.total ? <span className="font-normal text-muted-foreground">({fmt(accounts.total)})</span> : null}
        </h3>
        {accountsError && !accounts ? (
          <Surface>
            <ErrorState title="Couldn't load accounts" onRetry={() => mutateAccounts()} />
          </Surface>
        ) : (
          <AccountsTable
            data={accounts}
            loading={accountsLoading}
            onGrant={setGrantAccount}
            toolbar={
              <div className="relative w-full sm:w-72">
                <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search accounts…"
                  aria-label="Search accounts"
                  className="pl-10"
                />
              </div>
            }
          />
        )}
      </section>

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
