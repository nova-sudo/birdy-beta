"use client";

// The three tiers side by side. Without a plan a tier opens Whop's checkout;
// with one, a change opens Whop's portal (Whop has no in-place plan swap).

import { Check } from "lucide-react";
import { Button, Dialog, DialogBody, DialogContent, Pill, cn } from "@/components/by";
import { PLANS, PLAN_ORDER } from "@/components/billing/plans";
import { planAction } from "@/lib/plan-billing";

const LABEL = { checkout: "Get started", upgrade: "Upgrade", downgrade: "Downgrade" };
const TOP = PLAN_ORDER[PLAN_ORDER.length - 1];

function Tier({ plan, billing }) {
  const action = planAction(plan, billing.status, PLAN_ORDER);
  const current = action === "current";
  const extraPaid = billing.status?.extra_clients_paid ?? 0;
  return (
    <div className={cn("flex flex-col gap-3.5 rounded-by-lg border bg-by-surface p-4.5 shadow-by-card", current ? "border-by-accent outline-4 outline-by-accent-soft" : "border-by-line")}>
      <div className="flex items-center gap-2">
        <h3 className="flex-1 font-by-display text-by-heading font-bold">{plan.name}</h3>
        {current ? <Pill tone="accent" dot={false}>Current</Pill> : plan.id === TOP ? <Pill tone="accent" dot={false}>Best value</Pill> : plan.popular ? <Pill dot={false}>Most popular</Pill> : null}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-by-display text-by-display font-bold tracking-[-0.02em] tabular-nums">${plan.price}</span>
        <span className="text-by-body-sm text-by-muted">/mo</span>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-by-body-sm text-by-text-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-by-success" />{f}</li>
        ))}
        {current && plan.supportsExtraSlots && extraPaid > 0 && (
          <li className="flex items-start gap-2 text-by-body-sm font-semibold text-by-success"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{extraPaid} extra slot{extraPaid === 1 ? "" : "s"} active</li>
        )}
      </ul>
      {current ? (
        <div className="rounded-by-md bg-by-accent-soft py-2 text-center text-by-body-sm font-semibold text-by-accent">Your plan</div>
      ) : (
        <Button
          kind={action === "downgrade" ? "secondary" : "primary"}
          className="w-full"
          loading={action !== "checkout" && billing.openingPortal}
          onClick={() => billing.choosePlan(plan)}
          aria-label={`${LABEL[action]}: ${plan.name}`}
        >
          {LABEL[action]}
        </Button>
      )}
    </div>
  );
}

export function ComparePlansDialog({ open, onOpenChange, billing }) {
  const subscribed = !!billing.status?.subscribed;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        title={subscribed ? "Compare plans" : "Choose a plan"}
        description={subscribed ? "A plan change opens the Whop portal, where it’s prorated." : "Secure checkout powered by Whop."}
      >
        <DialogBody>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {PLANS.map((plan) => <Tier key={plan.id} plan={plan} billing={billing} />)}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
