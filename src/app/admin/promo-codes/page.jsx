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
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-50 text-gray-600 border-gray-200",
  archived: "bg-gray-50 text-gray-400 border-gray-200",
};

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
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create promo code</DialogTitle>
          <DialogDescription>Discounts apply automatically at Whop checkout.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="promo-code" className="text-xs font-semibold text-[#71658B]">Code</Label>
              <Input
                id="promo-code"
                placeholder="SAVE20"
                value={form.code}
                onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#71658B]">Duration (months)</Label>
              <Input
                type="number" min={1}
                value={form.promo_duration_months}
                onChange={(e) => set({ promo_duration_months: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-[#71658B]">Discount</Label>
            <div className="mt-1 flex gap-2">
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                <button
                  type="button"
                  onClick={() => set({ promo_type: "percentage" })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${form.promo_type === "percentage" ? "bg-white text-purple-700 shadow-sm ring-1 ring-purple-200" : "text-gray-500 hover:text-gray-700"}`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => set({ promo_type: "flat_amount" })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${form.promo_type === "flat_amount" ? "bg-white text-purple-700 shadow-sm ring-1 ring-purple-200" : "text-gray-500 hover:text-gray-700"}`}
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
            <Label className="text-xs font-semibold text-[#71658B]">Applies to</Label>
            <div className="mt-2 space-y-3">
              {subscriptionTargets.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-gray-400 mb-1.5">Subscription tiers</p>
                  <div className="flex flex-wrap gap-3">
                    {subscriptionTargets.map((t) => (
                      <label key={t.plan_id} className="flex items-center gap-1.5 text-sm text-gray-700">
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
                  <p className="text-[11px] font-medium text-gray-400 mb-1.5">Credit packs</p>
                  <div className="flex flex-wrap gap-3">
                    {creditTargets.map((t) => (
                      <label key={t.plan_id} className="flex items-center gap-1.5 text-sm text-gray-700">
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
                <p className="text-xs text-gray-400">No targetable plans configured yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3 space-y-2.5">
            {[
              ["new_users_only", "New users only"],
              ["existing_memberships_only", "Existing memberships only (retention offer)"],
              ["churned_users_only", "Churned users only (win-back offer)"],
              ["one_per_customer", "One use per customer"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700">{label}</span>
                <Switch checked={form[key]} onCheckedChange={(v) => set({ [key]: v })} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
              <span className="text-sm text-gray-700">Unlimited uses</span>
              <Switch checked={form.unlimited_stock} onCheckedChange={(v) => set({ unlimited_stock: v })} />
            </div>
            {!form.unlimited_stock && (
              <div>
                <Label className="text-xs font-semibold text-[#71658B]">Max uses</Label>
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
            <Label className="text-xs font-semibold text-[#71658B]">Expires (optional)</Label>
            <Input
              type="date"
              value={form.expires_at}
              onChange={(e) => set({ expires_at: e.target.value })}
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? "Creating…" : "Create promo code"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromoCodesTable({ codes, loading, onDelete }) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-xl border bg-white p-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">Code</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">Discount</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">Applies to</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">Status</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B] text-right">Uses</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#71658B]">Expires</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  No promo codes yet.
                </TableCell>
              </TableRow>
            )}
            {codes.map((c) => (
              <TableRow key={c.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-gray-900">
                    <Tag className="h-3.5 w-3.5 text-purple-500" /> {c.code}
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium text-gray-800">{discountLabel(c)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(c.target_labels || []).length > 0
                      ? c.target_labels.map((l) => (
                        <Badge key={l} variant="outline" className="text-[10px]">{l}</Badge>
                      ))
                      : <span className="text-xs text-gray-400">—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_STYLES[c.status] || STATUS_STYLES.inactive}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-gray-600">
                  {c.uses}{!c.unlimited_stock && c.stock ? ` / ${c.stock}` : ""}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(c.expires_at)}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onDelete(c)}
                    aria-label={`Delete promo code ${c.code}`}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
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
          <h2 className="text-xl font-bold text-[#1F1B33] flex items-center gap-2">
            <Percent className="h-5 w-5 text-purple-600" /> Promo Codes
          </h2>
          <p className="text-sm text-muted-foreground">
            Whop-native discount codes, scoped to subscription tiers or credit packs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Create promo code
        </button>
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
