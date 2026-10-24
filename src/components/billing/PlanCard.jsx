"use client";

import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Badge, Button, Surface } from "@/components/ds";
import { cn } from "@/lib/utils";
import { PLAN_ORDER } from "./plans";

const TOP_PLAN_ID = PLAN_ORDER[PLAN_ORDER.length - 1];

/**
 * One subscription tier, as both /billing and Settings → Billing draw it:
 * the top tier is a dark card, the current one is ringed in the primary colour.
 * The one primary button on a view is the most popular plan's "Get started"
 * for someone with no plan; every other action is an outline button.
 */
export function PlanCard({ plan, billingStatus, onCheckout, onManage, loadingManage }) {
  const isCurrent = billingStatus?.plan?.id === plan.id && billingStatus?.subscribed;
  const isDowngrade = billingStatus?.subscribed && PLAN_ORDER.indexOf(plan.id) < PLAN_ORDER.indexOf(billingStatus.plan?.id);
  const isTop = plan.id === TOP_PLAN_ID;
  const dark = isTop && !isCurrent;
  const startVariant = !billingStatus?.subscribed && plan.popular ? "primary" : "outline";

  return (
    <Surface
      data-plan={plan.id}
      className={cn(
        "flex h-full flex-col gap-4 p-5 transition-[transform,box-shadow] duration-300 ease-press hover:-translate-y-1 hover:shadow-floating motion-reduce:transform-none",
        dark && "bg-foreground text-primary-foreground",
        isCurrent && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className={cn("text-lg font-semibold", dark ? "text-primary-foreground" : "text-foreground")}>{plan.name}</h3>
        {isCurrent ? (
          <Badge tone="primary">Current</Badge>
        ) : isTop ? (
          <Badge tone="primary">Best value</Badge>
        ) : plan.popular ? (
          <Badge tone="neutral">Most popular</Badge>
        ) : null}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("num text-2xl font-semibold leading-none", dark ? "text-primary-foreground" : "text-foreground")}>${plan.price}</span>
        <span className={cn("text-xs", dark ? "text-primary-foreground/70" : "text-muted-foreground")}>/mo</span>
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {plan.features.map((f) => (
          <li key={f} className={cn("flex items-start gap-2 text-xs", dark ? "text-primary-foreground/80" : "text-body")}>
            <Check className={cn("mt-0.5 size-4 shrink-0", dark ? "text-primary-foreground" : "text-success")} />
            {f}
          </li>
        ))}
        {isCurrent && plan.supportsExtraSlots && billingStatus.extra_clients_paid > 0 && (
          <li className="flex items-start gap-2 text-xs font-semibold text-success-ink">
            <Check className="mt-0.5 size-4 shrink-0" />
            {billingStatus.extra_clients_paid} extra slot{billingStatus.extra_clients_paid !== 1 ? "s" : ""} active
          </li>
        )}
      </ul>
      {isCurrent ? (
        <div className="rounded-control bg-primary-soft py-2 text-center text-sm font-medium text-primary">Your plan</div>
      ) : (
        // Not subscribed and no checkout on this surface (Settings): send
        // them to /billing, where the checkout embed lives.
        !billingStatus?.subscribed && !onCheckout ? (
          <Button asChild variant={startVariant} className="w-full">
            <Link href="/billing">Get started</Link>
          </Button>
        ) : (
          <Button
            variant={startVariant}
            onClick={() => (billingStatus?.subscribed ? onManage() : onCheckout(plan))}
            disabled={billingStatus?.subscribed && loadingManage}
            className="w-full"
          >
            {billingStatus?.subscribed && loadingManage
              ? <><Loader2 className="size-4 animate-spin" />Opening…</>
              : billingStatus?.subscribed
                ? (isDowngrade ? "Downgrade" : "Upgrade")
                : "Get started"}
          </Button>
        )
      )}
    </Surface>
  );
}
