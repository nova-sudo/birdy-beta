"use client";

import { useState } from "react";
import {
  Percent, Plus, Trash2, Loader2, Tag,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { usePromoCodes, createPromoCode, deletePromoCode } from "@/lib/admin-api";

const STATUS_STYLES = {
  active: "bg-pd-success-bg text-pd-success",
  inactive: "bg-pd-divider text-pd-body",
  archived: "bg-pd-divider text-pd-faint",
};

const CARD = "rounded-xl border border-pd-border bg-pd-surface shadow-sm";
const TH = "bg-pd-table-head text-[11.5px] font-bold uppercase tracking-[.04em] text-pd-faint";
const TR = "border-b border-pd-row-border hover:bg-pd-table-head";

function discountLabel(code) {
  return code.promo_type === "percentage"
    ? `${code.amount_off}% off`
    : `$${code.amount_off} off`;
}

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return "—"; }
}

const EMPTY_FORM = {
  code: "",
  promo_type: "percentage",
  amount_off: "",
  plan_ids: [],
  new_users_only: false,
  existing_memberships_only: false,
  churned_users_only: false,
  one_per_customer: false,
  unlimited_stock: true,
  stock: "",
  expires_at: "",
  promo_duration_months: 1,
};

const SEGMENT_ACTIVE = "bg-pd-surface text-pd-primary shadow-sm ring-1 ring-pd-primary-pale";
const SEGMENT_IDLE = "text-pd-subtle hover:text-pd-ink";

function CreatePromoDialog({ open, onClose, targets, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const togglePlan = (planId) => {
    set({
      plan_ids: form.plan_ids.includes(planId)
        ? form.plan_ids.filter((p) => p !== planId)
        : [...form.plan_ids, planId],
    });
  };

  const subscriptionTargets = targets.filter((t) => t.group === "subscription");
  const creditTargets = targets.filter((t) => t.group === "credits");

  const submit = async () => {
    if (!form.code.trim()) return toast.error("Enter a code");
    if (!form.amount_off || Number(form.amount_off) <= 0) return toast.error("Enter a discount amount");
    if (form.plan_ids.length === 0) return toast.error("Select at least one plan to target");

    setSaving(true);
    try {
      await createPromoCode({
        code: form.code.trim(),
        promo_type: form.promo_type,
        amount_off: Number(form.amount_off),
        plan_ids: form.plan_ids,
        new_users_only: form.new_users_only,
        existing_memberships_only: form.existing_memberships_only || undefined,
        churned_users_only: form.churned_users_only || undefined,
        one_per_customer: form.one_per_customer || undefined,
        unlimited_stock: form.unlimited_stock,
        stock: form.unlimited_stock ? undefined : (Number(form.stock) || undefined),
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : undefined,
        promo_duration_months: Number(form.promo_duration_months) || 1,
      });
      toast.success(`Promo code ${form.code.trim().toUpperCase()} created`);
      setForm(EMPTY_FORM);
      onCreated();
    } catch (e) {
      toast.error("Couldn't create promo code", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setForm(EMPTY_FORM); onClose(); } }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-pd-display">Create promo code</DialogTitle>
          <DialogDescription>Discounts apply automatically at Whop checkout.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="promo-code" className="text-xs font-semibold text-pd-subtle">Code</Label>
              <Input
                id="promo-code"
                placeholder="SAVE20"
                value={form.code}
                onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-pd-subtle">Duration (months)</Label>
              <Input
                type="number" min={1}
                value={form.promo_duration_months}
                onChange={(e) => set({ promo_duration_months: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-pd-subtle">Discount</Label>
            <div className="mt-1 flex gap-2">
              <div className="inline-flex rounded-full border border-pd-border bg-pd-canvas p-0.5">
                <button
                  type="button"
                  onClick={() => set({ promo_type: "percentage" })}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${form.promo_type === "percentage" ? SEGMENT_ACTIVE : SEGMENT_IDLE}`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => set({ promo_type: "flat_amount" })}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${form.promo_type === "flat_amount" ? SEGMENT_ACTIVE : SEGMENT_IDLE}`}
                >
                  $
                </button>
              </div>
              <Input
                type="number" min={0} step="0.01"
                placeholder={form.promo_type === "percentage" ? "20" : "10.00"}
                value={form.amount_off}
                onChange={(e) => set({ amount_off: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-pd-subtle">Applies to</Label>
            <div className="mt-2 space-y-3">
              {subscriptionTargets.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-pd-faint mb-1.5">Subscription tiers</p>
                  <div className="flex flex-wrap gap-3">
                    {subscriptionTargets.map((t) => (
                      <label key={t.plan_id} className="flex items-center gap-1.5 text-sm text-pd-body">
                        <Checkbox
                          checked={form.plan_ids.includes(t.plan_id)}
                          onCheckedChange={() => togglePlan(t.plan_id)}
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {creditTargets.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-pd-faint mb-1.5">Credit packs</p>
                  <div className="flex flex-wrap gap-3">
                    {creditTargets.map((t) => (
                      <label key={t.plan_id} className="flex items-center gap-1.5 text-sm text-pd-body">
                        <Checkbox
                          checked={form.plan_ids.includes(t.plan_id)}
                          onCheckedChange={() => togglePlan(t.plan_id)}
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {targets.length === 0 && (
                <p className="text-xs text-pd-faint">No targetable plans configured yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-pd-border p-3 space-y-2.5">
            {[
              ["new_users_only", "New users only"],
              ["existing_memberships_only", "Existing memberships only (retention offer)"],
              ["churned_users_only", "Churned users only (win-back offer)"],
              ["one_per_customer", "One use per customer"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-pd-body">{label}</span>
                <Switch checked={form[key]} onCheckedChange={(v) => set({ [key]: v })} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-pd-border p-3">
              <span className="text-sm text-pd-body">Unlimited uses</span>
              <Switch checked={form.unlimited_stock} onCheckedChange={(v) => set({ unlimited_stock: v })} />
            </div>
            {!form.unlimited_stock && (
              <div>
                <Label className="text-xs font-semibold text-pd-subtle">Max uses</Label>
                <Input
                  type="number" min={1}
                  value={form.stock}
                  onChange={(e) => set({ stock: e.target.value })}
                  className="mt-1"
                />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-pd-subtle">Expires (optional)</Label>
            <Input
              type="date"
              value={form.expires_at}
              onChange={(e) => set({ expires_at: e.target.value })}
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? "Creating…" : "Create promo code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromoCodesTable({ codes, loading, onDelete }) {
  if (loading) {
    return (
      <div className={`${CARD} overflow-hidden`}>
        <Skeleton className="h-11 w-full rounded-none" />
        <div className="divide-y divide-pd-row-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-3.5 w-10" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-pd-border hover:bg-pd-table-head">
              <TableHead className={TH}>Code</TableHead>
              <TableHead className={TH}>Discount</TableHead>
              <TableHead className={TH}>Applies to</TableHead>
              <TableHead className={TH}>Status</TableHead>
              <TableHead className={`${TH} text-right`}>Uses</TableHead>
              <TableHead className={TH}>Expires</TableHead>
              <TableHead className={`${TH} w-10`} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.length === 0 && (
              <TableRow className={TR}>
                <TableCell colSpan={7} className="text-center text-sm text-pd-subtle py-10">
                  No promo codes yet.
                </TableCell>
              </TableRow>
            )}
            {codes.map((c) => (
              <TableRow key={c.id} className={`group ${TR}`}>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-pd-ink">
                    <Tag className="h-3.5 w-3.5 text-pd-primary" /> {c.code}
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium text-pd-ink">{discountLabel(c)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(c.target_labels || []).length > 0
                      ? c.target_labels.map((l) => (
                        <Badge key={l} variant="secondary" className="text-[10px] font-bold">{l}</Badge>
                      ))
                      : <span className="text-xs text-pd-faint">—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`text-[11px] font-bold ${STATUS_STYLES[c.status] || STATUS_STYLES.inactive}`}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-pd-body">
                  {c.uses}{!c.unlimited_stock && c.stock ? ` / ${c.stock}` : ""}
                </TableCell>
                <TableCell className="text-xs text-pd-subtle whitespace-nowrap">{fmtDate(c.expires_at)}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="destructive-outline"
                    size="icon-xs"
                    onClick={() => onDelete(c)}
                    aria-label={`Delete promo code ${c.code}`}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
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

export default function AdminPromoCodesPage() {
  const { data, isLoading, mutate } = usePromoCodes();
  const [createOpen, setCreateOpen] = useState(false);

  const codes = data?.codes || [];
  const targets = data?.targets || [];

  const handleDelete = async (code) => {
    if (!window.confirm(`Delete promo code ${code.code}? This can't be undone.`)) return;
    try {
      await deletePromoCode(code.id);
      toast.success(`Deleted ${code.code}`);
      void mutate();
    } catch (e) {
      toast.error("Couldn't delete promo code", { description: e.message });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pd-display text-xl font-bold text-pd-ink flex items-center gap-2">
            <Percent className="h-5 w-5 text-pd-primary" /> Promo Codes
          </h2>
          <p className="text-sm text-pd-subtle">
            Whop-native discount codes, scoped to subscription tiers or credit packs.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" /> Create promo code
        </Button>
      </div>

      <PromoCodesTable codes={codes} loading={isLoading} onDelete={handleDelete} />

      <CreatePromoDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        targets={targets}
        onCreated={() => { setCreateOpen(false); void mutate(); }}
      />
    </div>
  );
}
