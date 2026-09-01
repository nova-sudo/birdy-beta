"use client";

import Link from "next/link";
import { ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { PLANS, PLAN_ORDER, STATUS_STYLES, STATUS_LABELS } from "./plans";

// Settings is a redesigned surface, so the tiers wear Birdy tokens rather
// than the raw Tailwind hues /billing still uses: purple is the brand primary
// #6B4EE6, and the other two reuse Info and Success rather than inventing an
// accent — the style guide allows no new hues.
const TONES = {
  purple: { text: "text-pd-primary", tint: "bg-pd-primary-tint", solid: "bg-pd-primary hover:bg-[#5A3FD6]", border: "border-pd-primary" },
  blue: { text: "text-pd-info", tint: "bg-pd-info-bg", solid: "bg-pd-info hover:brightness-95", border: "border-pd-info" },
  emerald: { text: "text-pd-success", tint: "bg-pd-success-bg", solid: "bg-pd-success hover:brightness-95", border: "border-pd-success" },
};

/**
 * One tier, as the Settings Billing tab draws it.
 *
 * The same three plans /billing sells, without the feature checklist — in
 * Settings the reader has already bought; what they came for is which tier
 * they're on and what moving costs, so the card is the header, the price and
 * the one action.
 */
function PlanCard({ plan, billingStatus, onManage, loadingManage }) {
  const Icon = plan.icon;
  const c = TONES[plan.color];
  const subscribed = !!billingStatus?.subscribed;
  const isCurrent = subscribed && billingStatus?.plan?.id === plan.id;
  const isDowngrade =
    subscribed && PLAN_ORDER.indexOf(plan.id) < PLAN_ORDER.indexOf(billingStatus.plan?.id);

  // Sentence case throughout, like "Current plan" — Title Case would be the
  // odd one out in the row.
  const label = isCurrent
    ? "Current plan"
    : !subscribed
      ? "Get started"
      : isDowngrade
        ? "Downgrade"
        : "Upgrade";

  // Moving up is the outlined button: white surface, the tier's colour as its
  // text. It sits beside a filled "Current plan", and two solid blocks side by
  // side would read as two equally-live choices.
  const outlined = !isCurrent && subscribed && !isDowngrade;
  // A plan CTA is the card's whole point, so it takes the 10px "controls,
  // buttons" radius and a roomier 11px/14px over the 9px/13px the guide gives
  // an inline toolbar button. Secondary keeps the #DFDFE8 input border and
  // carries the tier's colour as its text — moving up sits beside a filled
  // "Current plan", and two solid blocks side by side would read as two
  // equally-live choices.
  const buttonClass = [
    "w-full rounded-[10px] px-4 py-[11px] text-[14px] font-semibold transition-colors",
    "flex items-center justify-center gap-2",
    outlined
      ? `border border-[#DFDFE8] bg-pd-surface ${c.text} hover:bg-pd-divider`
      : `text-white ${c.solid}`,
  ].join(" ");

  const body = (
    <>
      <div className="flex items-center gap-[10px]">
        {/* KPI-chip metrics: 34px square, 10px radius, 17px icon. */}
        <div className={`flex size-[34px] shrink-0 items-center justify-center rounded-[10px] ${c.tint}`}>
          <Icon className={`size-[17px] ${c.text}`} />
        </div>
        <div className="min-w-0">
          <h3 className="font-pd-display text-[15px] font-semibold text-pd-ink">{plan.name}</h3>
          <p className="mt-0.5 text-[12px] text-pd-faint">Up to {plan.maxClients} clients</p>
        </div>
      </div>

      <div className="mt-[18px] mb-[18px] flex items-baseline gap-1.5">
        <span className="font-pd-display text-[28px] font-bold leading-none text-pd-ink">
          ${plan.price}
        </span>
        <span className="text-[12px] text-pd-faint">/mo</span>
      </div>

      <div className="mt-auto">
        {/* Changing tier is Whop's job — the portal handles proration, so
            Settings sends the reader there rather than running a second
            checkout of its own. Nobody subscribed yet goes to /billing,
            which is where the checkout embed lives.

            The current tier is a plate, not a button: it stays at full
            strength rather than greying out the way a disabled button
            would, because it's stating a fact, not offering an action. */}
        {isCurrent ? (
          <div className={buttonClass}>{label}</div>
        ) : subscribed ? (
          <button
            type="button"
            onClick={onManage}
            disabled={loadingManage}
            className={`${buttonClass} disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {loadingManage
              ? <><Loader2 className="w-4 h-4 animate-spin" />Opening…</>
              : label}
          </button>
        ) : (
          <Link href="/billing" className={buttonClass}>
            {label}
          </Link>
        )}
      </div>
    </>
  );

  // The popular tier is framed rather than bordered: the ribbon is the frame's
  // own top edge, with the white body inset inside it. Scaling it up is what
  // makes it break the row's top and bottom line. Its shadow is the guide's
  // "selected" one — the only shadow allowed on a card, and only because this
  // card is selected rather than decorated.
  if (plan.popular) {
    return (
      <div className={`relative z-10 rounded-2xl p-[3px] shadow-pd-segment md:scale-105 ${c.solid.split(" ")[0]}`}>
        <div className="pb-[5px] text-center text-[11px] font-bold tracking-[.03em] text-white">
          MOST POPULAR
        </div>
        <div className="flex flex-col rounded-[13px] bg-pd-surface px-[22px] py-5">
          {body}
        </div>
      </div>
    );
  }

  // Ordinary cards are flat: 1px #ECECF2, radius 16px, padding 20px 22px.
  return (
    <div
      className={[
        "flex flex-col rounded-2xl bg-pd-surface px-[22px] py-5 border",
        isCurrent ? c.border : "border-pd-border",
      ].join(" ")}
    >
      {body}
    </div>
  );
}

/**
 * The "Your plan" block on Settings → Billing: which tier you're on, how much
 * of its client-group allowance you've spent, and the three tiers as cards.
 *
 * Plans come from the shared module /billing sells from, so prices and limits
 * can't drift between the two pages.
 */
export function PlanPicker({ billingStatus, onManage, loadingManage }) {
  const subscribed = !!billingStatus?.subscribed;
  const current = PLANS.find((p) => p.id === billingStatus?.plan?.id);
  const status = billingStatus?.status;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-pd-display text-[19px] font-bold tracking-[-0.02em] text-pd-ink">
          Your plan
        </h2>
        {/* Status pill: Inter 600 11px, padding 3px 9px, radius 6px. */}
        {subscribed && status && (
          <span className={`inline-flex items-center rounded-md px-[9px] py-[3px] text-[11px] font-semibold ${STATUS_STYLES[status] ?? STATUS_STYLES.inactive}`}>
            {STATUS_LABELS[status] ?? status}
          </span>
        )}
      </div>

      <p className="mt-1 text-[12px] text-pd-faint">
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

      {/* 18px between cards in a row, per the spacing scale. items-center so
          the scaled-up popular card breaks the row's line top and bottom; the
          gap absorbs the width it gains. */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-[18px] items-center">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            billingStatus={billingStatus}
            onManage={onManage}
            loadingManage={loadingManage}
          />
        ))}
      </div>

      {subscribed && (
        <div className="mt-[14px] flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-pd-faint">
          {billingStatus.current_period_end && (
            <span>
              {billingStatus.cancel_at_period_end ? "Cancels" : "Renews"}{" "}
              <span className="font-semibold text-pd-body">
                {new Date(billingStatus.current_period_end).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
            </span>
          )}
          {/* Secondary button: #5A5A6E on #fff, 1px #DFDFE8, 9px 16px, radius 9px. */}
          <button
            type="button"
            onClick={onManage}
            disabled={loadingManage}
            className="ml-auto flex items-center gap-[7px] rounded-[9px] border border-[#DFDFE8] bg-pd-surface px-4 py-[9px] text-[13px] font-semibold text-pd-body transition-colors hover:bg-pd-divider disabled:opacity-60"
          >
            {loadingManage
              ? <Loader2 className="size-[14px] animate-spin" />
              : <ExternalLink className="size-[14px]" />}
            Manage billing
          </button>
        </div>
      )}

      {/* Problem surface: #FEF6F6 on a #F8DEDE border, 12px radius, 14px 16px. */}
      {billingStatus?.cancel_at_period_end && (
        <div className="mt-[14px] flex items-center gap-[11px] rounded-xl border border-pd-danger-border bg-pd-danger-surface px-4 py-[14px] text-[12px] leading-[1.45] text-pd-body">
          <AlertCircle className="size-[15px] shrink-0 text-pd-danger" />
          Your subscription will cancel at the end of this billing period.
        </div>
      )}
    </section>
  );
}
