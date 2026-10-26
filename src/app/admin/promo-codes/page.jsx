"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Checkbox,
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
  SegmentedTabs,
  Surface,
  Switch,
  confirm,
  StateBadge,
  badgeStateOf,
} from "@/components/ds";
import AdminHeader from "@/components/admin/AdminHeader";
import { usePromoCodes, createPromoCode, deletePromoCode } from "@/lib/admin-api";

// Each status is drawn by the shared badge state of the same name (active, scheduled,
// expired, inactive, archived).
const STATUS_OPTIONS = ["active", "scheduled", "expired", "inactive", "archived"].map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}));

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

  const targetChecks = (list) => (
    <div className="flex flex-wrap gap-3">
      {list.map((t) => (
        <label key={t.plan_id} className="flex items-center gap-1.5 text-sm text-body">
          <Checkbox
            checked={form.plan_ids.includes(t.plan_id)}
            onCheckedChange={() => togglePlan(t.plan_id)}
          />
          {t.label}
        </label>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setForm(EMPTY_FORM); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create promo code</DialogTitle>
          <DialogDescription>Discounts apply automatically at Whop checkout.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="promo-code">Code</Label>
              <Input
                id="promo-code"
                placeholder="SAVE20"
                value={form.code}
                onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-duration">Duration (months)</Label>
              <Input
                id="promo-duration"
                type="number" min={1}
                value={form.promo_duration_months}
                onChange={(e) => set({ promo_duration_months: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="promo-amount">Discount</Label>
            <div className="flex gap-2">
              <SegmentedTabs
                ariaLabel="Discount type"
                value={form.promo_type}
                onValueChange={(v) => set({ promo_type: v })}
                items={[
                  { value: "percentage", label: "%" },
                  { value: "flat_amount", label: "$" },
                ]}
              />
              <Input
                id="promo-amount"
                type="number" min={0} step="0.01"
                placeholder={form.promo_type === "percentage" ? "20" : "10.00"}
                value={form.amount_off}
                onChange={(e) => set({ amount_off: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Applies to</Label>
            <div className="space-y-3">
              {subscriptionTargets.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Subscription tiers</p>
                  {targetChecks(subscriptionTargets)}
                </div>
              )}
              {creditTargets.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Credit packs</p>
                  {targetChecks(creditTargets)}
                </div>
              )}
              {targets.length === 0 && (
                <p className="text-xs text-muted-foreground">No targetable plans configured yet.</p>
              )}
            </div>
          </div>

          <div className="space-y-2.5 rounded-control bg-muted p-3">
            {[
              ["new_users_only", "New users only"],
              ["existing_memberships_only", "Existing memberships only (retention offer)"],
              ["churned_users_only", "Churned users only (win-back offer)"],
              ["one_per_customer", "One use per customer"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-body">{label}</span>
                <Switch checked={form[key]} onCheckedChange={(v) => set({ [key]: v })} aria-label={label} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 items-end gap-3">
            <div className="flex items-center justify-between gap-3 rounded-control bg-muted p-3">
              <span className="text-sm text-body">Unlimited uses</span>
              <Switch
                checked={form.unlimited_stock}
                onCheckedChange={(v) => set({ unlimited_stock: v })}
                aria-label="Unlimited uses"
              />
            </div>
            {!form.unlimited_stock && (
              <div className="space-y-1.5">
                <Label htmlFor="promo-stock">Max uses</Label>
                <Input
                  id="promo-stock"
                  type="number" min={1}
                  value={form.stock}
                  onChange={(e) => set({ stock: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="promo-expires">Expires (optional)</Label>
            <Input
              id="promo-expires"
              type="date"
              value={form.expires_at}
              onChange={(e) => set({ expires_at: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="primary" onClick={submit} loading={saving}>
            <Plus aria-hidden />
            {saving ? "Creating…" : "Create promo code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromoCodesTable({ codes, loading, onDelete }) {
  const columns = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        meta: { label: "codes", variant: "text" },
        cell: ({ row }) => <span className="font-mono text-sm font-semibold text-foreground">{row.original.code}</span>,
      },
      {
        id: "discount",
        accessorFn: (c) => Number(c.amount_off) || 0,
        header: "Discount",
        meta: { label: "Discount" },
        cell: ({ row }) => <span className="text-sm font-medium text-foreground">{discountLabel(row.original)}</span>,
      },
      {
        id: "applies_to",
        accessorFn: (c) => (c.target_labels || []).join(", "),
        header: "Applies to",
        enableSorting: false,
        meta: { label: "Applies to" },
        cell: ({ row }) => {
          const labels = row.original.target_labels || [];
          return labels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {labels.map((l) => <Badge key={l}>{l}</Badge>)}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: { label: "Status", variant: "select", options: STATUS_OPTIONS },
        cell: ({ row }) => (
          <StateBadge state={badgeStateOf(row.original.status)}>
            <span className="capitalize">{row.original.status}</span>
          </StateBadge>
        ),
      },
      {
        id: "uses",
        accessorFn: (c) => c.uses,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Uses" align="right" />,
        meta: { label: "Uses" },
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="num text-right text-sm text-body">
              {c.uses}{!c.unlimited_stock && c.stock ? ` / ${c.stock}` : ""}
            </div>
          );
        },
      },
      {
        id: "expires",
        accessorFn: (c) => (c.expires_at ? new Date(c.expires_at).getTime() : 0),
        header: "Expires",
        meta: { label: "Expires" },
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{fmtDate(row.original.expires_at)}</span>,
      },
      {
        id: "delete",
        header: () => <span className="sr-only">Delete</span>,
        enableSorting: false,
        enableHiding: false,
        meta: { label: "Delete" },
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(row.original)}
            aria-label={`Delete promo code ${row.original.code}`}
            className="text-danger hover:bg-danger-soft"
          >
            <Trash2 aria-hidden />
          </Button>
        ),
      },
    ],
    [onDelete]
  );

  return (
    <DataTable
      columns={columns}
      data={codes}
      loading={loading}
      getRowId={(c) => String(c.id)}
      empty={<EmptyState title="No promo codes yet." />}
    />
  );
}

export default function AdminPromoCodesPage() {
  const { data, error, isLoading, mutate } = usePromoCodes();
  const [createOpen, setCreateOpen] = useState(false);

  const codes = useMemo(() => data?.codes || [], [data]);
  const targets = data?.targets || [];

  const handleDelete = async (code) => {
    const ok = await confirm({
      title: `Delete promo code ${code.code}?`,
      description: "This can't be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
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
      <AdminHeader
        title="Promo Codes"
        description="Whop-native discount codes, scoped to subscription tiers or credit packs."
        actions={
          <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden /> Create promo code
          </Button>
        }
      />

      {error && !data ? (
        <Surface>
          <ErrorState title="Couldn't load promo codes" onRetry={() => mutate()} />
        </Surface>
      ) : (
        <PromoCodesTable codes={codes} loading={isLoading} onDelete={handleDelete} />
      )}

      <CreatePromoDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        targets={targets}
        onCreated={() => { setCreateOpen(false); void mutate(); }}
      />
    </div>
  );
}
