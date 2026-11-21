"use client";

// "Your plan": the tier, its status and price, the client slots, and the ways
// to change it. Cancelling happens here (Whop's API cancels in place, at the
// end of the period); a plan change or a new card happens in Whop's portal.

import { useState } from "react";
import { AlertCircle, CreditCard, ExternalLink, Plus } from "lucide-react";
import { Button, Card, Notice, Pill, Skeleton } from "@/components/by";
import { PLANS, PLAN_ORDER } from "@/components/billing/plans";
import {
  EXTRA_CLIENT_PRICE, STATUS_TONE, STATUS_WORDS, currentPlan, dateLabel, nextPlan, periodLine, slotGrid,
} from "@/lib/plan-billing";
import { EXTRA_CLIENT_PLAN_ID } from "./use-billing";
import { CardHeading } from "./plan-parts";

const DOT = { included: "bg-by-accent", extra: "bg-by-accent-line", free: "bg-by-sunken" };

function SlotGrid({ status }) {
  const grid = slotGrid(status);
  if (!grid) return null;
  const extra = grid.includes("extra");
  return (
    <>
      <div aria-hidden="true" className="mt-2.5 grid grid-cols-[repeat(25,minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(50,minmax(0,1fr))]">
        {grid.map((kind, i) => <i key={i} className={`aspect-square max-w-2 rounded-full ${DOT[kind]}`} />)}
      </div>
      <div className="mt-2 flex gap-3 text-by-caption text-by-muted">
        <span className="inline-flex items-center gap-1"><i className={`size-1.5 rounded-full ${DOT.included}`} />Included</span>
        {extra && <span className="inline-flex items-center gap-1"><i className={`size-1.5 rounded-full ${DOT.extra}`} />Extra</span>}
        <span className="inline-flex items-center gap-1"><i className={`size-1.5 rounded-full ${DOT.free} ring-1 ring-by-line`} />Free</span>
      </div>
    </>
  );
}

export function YourPlanCard({ billing, onCompare }) {
  const { status, loading, loadError } = billing;
  const [confirming, setConfirming] = useState(false);

  if (loading) {
    return (
      <Card padded className="flex flex-col gap-3 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-9 w-56" />
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card padded className="p-5">
        <CardHeading title="Your plan" />
        <Notice tone="danger" className="mt-3" action={<Button size="sm" onClick={billing.reload}>Retry</Button>}>Couldn’t load your plan. Check your connection and try again.</Notice>
      </Card>
    );
  }

  const plan = currentPlan(status, PLANS);
  const next = nextPlan(plan, PLANS, PLAN_ORDER);
  const extraSlots = plan?.supportsExtraSlots && !!EXTRA_CLIENT_PLAN_ID;
  const limit = status?.client_limit ?? 0;
  const used = status?.client_count ?? 0;
  const extraPaid = status?.extra_clients_paid ?? 0;
  const ending = !!status?.cancel_at_period_end;

  return (
    <Card padded className="flex flex-col p-5">
      <CardHeading title="Your plan" sub={periodLine(status)} />

      {plan ? (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-by-display text-by-display font-bold tracking-[-0.02em]">{plan.name}</span>
            {status.status && <Pill tone={STATUS_TONE[status.status] ?? "neutral"} dot={false} className="uppercase tracking-[0.06em]">{STATUS_WORDS[status.status] ?? status.status}</Pill>}
            <span className="ml-auto text-by-body text-by-text-2 tabular-nums">${plan.price} / month</span>
          </div>
          {limit > 0 && (
            <p className="mt-2 text-by-body text-by-text-2">
              <b className="font-semibold text-by-text tabular-nums">{used} of {limit}</b> client slots used
              {extraPaid > 0 && <> · {limit - extraPaid} included + {extraPaid} extra at ${EXTRA_CLIENT_PRICE} each</>}
            </p>
          )}
          <SlotGrid status={status} />
        </>
      ) : (
        <div className="mt-3">
          <span className="font-by-display text-by-display font-bold tracking-[-0.02em]">No plan yet</span>
          <p className="mt-1 text-by-body text-by-text-2">
            Pick a plan to connect your clients.
            {limit > 0 && <> {used} of {limit} client slots used.</>}
          </p>
        </div>
      )}

      {ending && (
        <Notice tone="warning" icon={<AlertCircle aria-hidden="true" />} className="mt-3.5" action={<Button size="sm" loading={billing.busy} onClick={billing.reactivate}>Keep my subscription</Button>}>
          Your subscription ends {status.current_period_end ? dateLabel(status.current_period_end) : "at the end of this period"}.
        </Notice>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {plan ? (
          <>
            {next && <Button kind="primary" onClick={() => billing.choosePlan(next)} disabled={billing.openingPortal}>Upgrade to {next.name}</Button>}
            <Button loading={billing.openingPortal} onClick={billing.openPortal}><CreditCard aria-hidden="true" />Manage billing<ExternalLink aria-hidden="true" className="text-by-muted" /></Button>
            <Button onClick={onCompare}>Compare plans</Button>
            {extraSlots && <Button kind="soft" onClick={billing.addExtraSlot}><Plus aria-hidden="true" />Extra client slot · ${EXTRA_CLIENT_PRICE}/mo</Button>}
          </>
        ) : (
          <Button kind="primary" onClick={onCompare}>Choose a plan</Button>
        )}
      </div>

      {plan && !ending && !confirming && (
        <p className="mt-3 text-by-caption text-by-muted">
          Changing plan or updating your card happens in the Whop portal.{" "}
          <button type="button" onClick={() => setConfirming(true)} disabled={billing.busy} className="cursor-pointer font-semibold text-by-text-2 underline underline-offset-2 hover:text-by-text disabled:opacity-60">
            Cancel your subscription
          </button>
        </p>
      )}

      {confirming && (
        <div role="group" aria-label="Cancel your subscription" className="mt-3.5 rounded-by-md border border-by-line bg-by-canvas px-4 py-3.5 text-by-body-sm text-by-text-2">
          <p className="font-semibold text-by-text">Cancel your subscription?</p>
          <p className="mt-1">
            You keep {plan?.name ? `${plan.name} ` : ""}access until{" "}
            <b className="font-semibold text-by-text">{status?.current_period_end ? dateLabel(status.current_period_end) : "the end of the current period"}</b>, and you’re not charged again.
            After that your client groups stop refreshing. You can undo this any time before then.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button kind="danger" size="sm" loading={billing.busy} onClick={async () => { await billing.cancel(); setConfirming(false); }}>Yes, cancel it</Button>
            <Button size="sm" disabled={billing.busy} onClick={() => setConfirming(false)}>Keep my subscription</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
