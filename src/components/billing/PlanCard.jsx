"use client";

import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLAN_ORDER } from "./plans";

const TOP_PLAN_ID = PLAN_ORDER[PLAN_ORDER.length - 1];

/**
 * One subscription tier, as both /billing and Settings → Billing draw it:
 * the top tier is a dark card, the current one is ringed in violet.
 */
export function PlanCard({ plan, billingStatus, onCheckout, onManage, loadingManage }) {
  const isCurrent = billingStatus?.plan?.id === plan.id && billingStatus?.subscribed;
  const isDowngrade = billingStatus?.subscribed && PLAN_ORDER.indexOf(plan.id) < PLAN_ORDER.indexOf(billingStatus.plan?.id);
  const isTop = plan.id === TOP_PLAN_ID;
  const dark = isTop && !isCurrent;

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-4 rounded-xl border p-5 shadow-sm transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none",
        dark ? "border-pd-ink bg-pd-ink text-white" : "border-pd-border bg-pd-surface",
        isCurrent && "border-2 border-pd-primary shadow-[0_0_0_5px_rgba(91,63,214,.10)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className={cn("font-pd-display text-[18px] font-bold", dark ? "text-white" : "text-pd-ink")}>{plan.name}</h3>
        {isCurrent ? (
          <span className="rounded-full bg-pd-primary px-2.5 py-0.5 text-[11.5px] font-bold text-white">Current</span>
        ) : isTop ? (
          <span className="rounded-full bg-pd-primary px-2.5 py-0.5 text-[11.5px] font-bold text-white">Best value</span>
        ) : plan.popular ? (
          <span className="rounded-full bg-gray-600 px-2.5 py-0.5 text-[11.5px] font-bold text-white">Most popular</span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("font-pd-display text-[38px] font-extrabold leading-none tracking-[-0.03em]", dark ? "text-white" : "text-pd-ink")}>${plan.price}</span>
        <span className={cn("text-[13px]", dark ? "text-gray-400" : "text-pd-subtle")}>/mo</span>
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {plan.features.map((f) => (
          <li key={f} className={cn("flex items-start gap-2 text-[13px]", dark ? "text-gray-300" : "text-pd-body")}>
            <Check className={cn("mt-0.5 size-4 shrink-0", dark ? "text-purple-300" : "text-pd-success")} />
            {f}
          </li>
        ))}
        {isCurrent && plan.supportsExtraSlots && billingStatus.extra_clients_paid > 0 && (
          <li className="flex items-start gap-2 text-[13px] font-semibold text-pd-success">
            <Check className="mt-0.5 size-4 shrink-0" />
            {billingStatus.extra_clients_paid} extra slot{billingStatus.extra_clients_paid !== 1 ? "s" : ""} active
          </li>
        )}
      </ul>
      {isCurrent ? (
        <div className="rounded-full bg-pd-primary-tint py-2.5 text-center text-sm font-semibold text-pd-primary">Your plan</div>
      ) : (
        // Not subscribed and no checkout on this surface (Settings): send
        // them to /billing, where the checkout embed lives.
        !billingStatus?.subscribed && !onCheckout ? (
          <Button asChild className="w-full">
            <Link href="/billing">Get started</Link>
          </Button>
        ) : (
          <Button
            variant={isDowngrade ? "outline" : "default"}
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
    </div>
  );
}

