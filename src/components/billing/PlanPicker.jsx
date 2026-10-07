"use client";

import { useState } from "react";
import { ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stagger, StaggerItem } from "@/components/motion";
import { PlanCard } from "./PlanCard";
import { PLANS, STATUS_STYLES, STATUS_LABELS } from "./plans";

const dateLabel = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * The "Your plan" block on Settings → Billing: which tier you're on, how much
 * of its client-group allowance you've spent, the three tiers as the same
 * cards /billing draws, and the cancel / keep controls.
 *
 * Plans come from the shared module /billing sells from, so prices and limits
 * can't drift between the two pages.
 */
export function PlanPicker({
  billingStatus,
  onManage,
  loadingManage,
  onCancel,
  onReactivate,
  busySubscription,
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const subscribed = !!billingStatus?.subscribed;
  const current = PLANS.find((p) => p.id === billingStatus?.plan?.id);
  const status = billingStatus?.status;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-pd-display text-[19px] font-bold tracking-[-0.02em] text-pd-ink">
          Your plan
        </h2>
        {subscribed && status && (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${STATUS_STYLES[status] ?? STATUS_STYLES.inactive}`}>
            {STATUS_LABELS[status] ?? status}
          </span>
        )}
      </div>

      <p className="mt-1 text-[12.5px] text-pd-subtle">
        {subscribed && current ? (
          <>
            You&apos;re currently on the{" "}
            <span className="font-semibold text-pd-ink">{current.name}</span> plan
            {billingStatus.client_limit > 0 && (
              <> · {billingStatus.client_count} of {billingStatus.client_limit} client groups used</>
            )}
            {billingStatus.extra_clients_paid > 0 && (
              <> (+{billingStatus.extra_clients_paid} extra)</>
            )}
          </>
        ) : (
          <>You don&apos;t have a plan yet — pick one to connect more client groups.</>
        )}
      </p>

      <Stagger className="mt-4 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <StaggerItem key={plan.id}>
            <PlanCard
              plan={plan}
              billingStatus={billingStatus}
              onManage={onManage}
              loadingManage={loadingManage}
            />
          </StaggerItem>
        ))}
      </Stagger>

      {subscribed && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-pd-subtle">
          {billingStatus.current_period_end && (
            <span>
              {billingStatus.cancel_at_period_end ? "Cancels" : "Renews"}{" "}
              <span className="font-semibold text-pd-ink">{dateLabel(billingStatus.current_period_end)}</span>
            </span>
          )}
          <Button variant="outline" onClick={onManage} disabled={loadingManage} className="ml-auto gap-1.5">
            {loadingManage ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
            Manage billing
          </Button>
        </div>
      )}

      {/* Cancelling happens here, not in Whop's portal. Whop's API cancels a
          membership directly (memberships.cancel, via POST /api/billing/cancel),
          so the portal is only for changing plan and updating a card.

          At period end, never immediately: the customer has paid for the
          period they are in. */}
      {subscribed && !billingStatus?.cancel_at_period_end && (
        <p className="mt-3 text-[12.5px] leading-[1.45] text-pd-subtle">
          Changing plan or updating your card happens in the Whop portal.{" "}
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            disabled={busySubscription}
            className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-semibold text-pd-body underline underline-offset-2 hover:text-pd-ink disabled:opacity-60"
          >
            Cancel your subscription
          </button>
          .
        </p>
      )}

      {confirmingCancel && (
        <div className="mt-4 rounded-xl border border-pd-border bg-pd-canvas px-5 py-4 text-[13px] leading-[1.5] text-pd-body">
          <p className="font-pd-display text-[15px] font-semibold text-pd-ink">Cancel your subscription?</p>
          <p className="mt-1">
            You keep {current?.name ? `${current.name} ` : ""}access until{" "}
            <span className="font-semibold text-pd-ink">
              {billingStatus?.current_period_end
                ? dateLabel(billingStatus.current_period_end)
                : "the end of the current period"}
            </span>
            , and you&apos;re not charged again. After that your client groups stop refreshing.
            You can undo this any time before then.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="destructive"
              onClick={async () => { await onCancel?.(); setConfirmingCancel(false) }}
              disabled={busySubscription}
              className="gap-1.5"
            >
              {busySubscription && <Loader2 className="size-4 animate-spin" />}
              Yes, cancel it
            </Button>
            <Button variant="outline" onClick={() => setConfirmingCancel(false)} disabled={busySubscription}>
              Keep my subscription
            </Button>
          </div>
        </div>
      )}

      {billingStatus?.cancel_at_period_end && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-pd-warning-bg px-4 py-3 text-[13px] leading-[1.45] text-pd-amber">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            Your subscription will cancel at the end of this billing period.{" "}
            <button
              type="button"
              onClick={onReactivate}
              disabled={busySubscription}
              className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-pd-primary underline underline-offset-2 disabled:opacity-60"
            >
              Keep my subscription
            </button>
            .
          </span>
        </div>
      )}
    </section>
  );
}
