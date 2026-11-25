"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button, Notice, OptionCard, Pill, Skeleton } from "@/components/by";
import { PLANS } from "@/components/billing/plans";
import { checkoutOutcome, checkoutProblem } from "@/components/billing/whop";
import { apiRequest } from "@/lib/api";
import { EXTRA_CLIENT_PRICE } from "@/lib/plan-billing";
import { clientsToFit } from "@/lib/setup-steps";
import { Bubble, Reply, Say } from "./chat-parts";

function CheckoutSkeleton() {
  return (
    <div aria-label="Loading the checkout" className="flex flex-col gap-2.5 py-2">
      <Skeleton className="h-10 w-full rounded-by-md" />
      <Skeleton className="h-10 w-full rounded-by-md" />
      <Skeleton className="h-10 w-2/3 rounded-by-md" />
      <Skeleton className="h-11 w-full rounded-by-md" />
    </div>
  );
}

// The checkout's code failed to load at all (offline, blocked): say so instead of a blank box.
function CheckoutUnavailable() {
  return (
    <Notice tone="danger" action={<Button size="sm" onClick={() => window.location.reload()}>Reload</Button>}>
      The checkout didn’t load. Check your connection, then reload the page.
    </Notice>
  );
}

const WhopCheckout = dynamic(
  () => import("@/components/billing/whop-checkout").then((m) => m.WhopCheckout).catch(() => CheckoutUnavailable),
  { ssr: false, loading: CheckoutSkeleton },
);

/** How long the checkout may take to say it's ready before we offer to load it again. */
const LOAD_TIMEOUT = 20000;
/** Whop's activation takes seconds; keep checking, more slowly, until it lands. */
const POLL_DELAYS = [1500, 3000, 5000, 8000, 12000];
/** Which plan was being bought when Whop sent the browser away to confirm a payment. */
const PICK_KEY = "birdy_setup_plan";
/** The flag Whop's return URL carries back to /welcome. */
const RETURN_FLAG = "checkout";

const readPick = () => {
  try { return sessionStorage.getItem(PICK_KEY); } catch { return null; }
};
const writePick = (id) => {
  try { sessionStorage.setItem(PICK_KEY, id); } catch { /* fine without it */ }
};

async function fetchBilling() {
  try {
    const res = await apiRequest("/api/billing/status");
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The plan that fits `count` clients, or null when even the biggest doesn't. */
export function planThatFits(count) {
  return PLANS.find((p) => count <= p.maxClients) ?? null;
}

function capacity(plan) {
  return plan.supportsExtraSlots
    ? `Up to ${plan.maxClients} clients, then $${EXTRA_CLIENT_PRICE}/mo per extra slot`
    : `Up to ${plan.maxClients} clients`;
}

/** What the person picked, for their reply once the plan is on: "Growth · $297/mo". Null when billing doesn't say. */
export function pickedPlanLine(billing) {
  if (!billing?.subscribed || !billing.plan) return null;
  const known = PLANS.find((p) => p.id === billing.plan.id);
  if (known) return `${known.name} · $${known.price}/mo`;
  return billing.plan.name || null;
}

/** Agency Ops' line before the plans: the tools are in, pick a plan, and how many clients it has to fit when known. */
function planLine(fit, completed) {
  const found = fit && (fit.source === "ghl"
    ? `I found ${plural(fit.count, "sub-account")} in GoHighLevel.`
    : `You have ${plural(fit.count, "client")} in Birdy.`);
  if (completed) return `Every account now needs a plan.${found ? ` ${found}` : ""} Everything you set up is kept, and you carry on where you left off once it’s active.`;
  return `Your tools are connected.${found ? ` ${found}` : ""} Pick a plan to carry on, and we’ll add your first client next.`;
}

/**
 * Setup's plan step, in the chat: Agency Ops says the tools are in, and the
 * three plans sit under it beside the checkout for the one picked (a sandbox
 * account starts a plan without paying). It's required: nothing after it
 * shows until the plan is on. Once it is, the line stays in the chat with
 * the person's pick as their reply, and setup carries on with the first client.
 *
 * @param {object} props.facts setup's facts (lib/use-setup), with `billing`
 * @param {Record<string, string>} props.steps
 * @param {string} props.agentName
 * @param {boolean} [props.completed] setup was finished before plans were required
 * @param {() => void | Promise<void>} props.onActive called once the subscription is active
 */
export function PlanStep({ facts, steps, agentName, completed = false, onActive }) {
  const fit = clientsToFit(facts);
  if (steps.plan === "done") {
    const picked = pickedPlanLine(facts.billing);
    return (
      <>
        <Bubble name={agentName} id="step-plan"><Say>{planLine(null, completed)}</Say></Bubble>
        {picked && <Reply>{picked}</Reply>}
      </>
    );
  }
  return (
    <Bubble name={agentName} id="step-plan">
      <Say>{planLine(fit, completed)}</Say>
      <PlanPicker facts={facts} fit={fit} onActive={onActive} />
    </Bubble>
  );
}

/** The three plans beside the checkout for the one picked, or the sandbox's start button. */
function PlanPicker({ facts, fit, onActive }) {
  const search = useSearchParams();
  const billing = facts.billing;
  const sandbox = Boolean(billing?.sandbox);
  const fitting = fit ? planThatFits(fit.count) : null;
  const tooBig = Boolean(fit && !fitting);
  const buyable = (p) => sandbox || Boolean(p.planId);

  const [planId, setPlanId] = useState(() => {
    const suggested = fitting ?? (tooBig ? PLANS[PLANS.length - 1] : null);
    return suggested && buyable(suggested) ? suggested.id : null;
  });
  const plan = PLANS.find((p) => p.id === planId) ?? null;
  const [phase, setPhase] = useState("picking"); // picking | waiting
  const [slow, setSlow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState(null);
  const timer = useRef(null);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    clearTimeout(timer.current);
    void onActive();
  }, [onActive]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const waitForIt = useCallback(() => {
    setPhase("waiting");
    let tries = 0;
    const tick = async () => {
      if ((await fetchBilling())?.subscribed) return finish();
      tries += 1;
      if (tries >= POLL_DELAYS.length) setSlow(true);
      timer.current = setTimeout(tick, POLL_DELAYS[Math.min(tries, POLL_DELAYS.length - 1)]);
    };
    timer.current = setTimeout(tick, POLL_DELAYS[0]);
  }, [finish]);

  // Back from Whop's return URL (a payment that needed the bank's confirmation):
  // a paid plan is waited for (and if it's already on, setup carries on at
  // once); an unpaid one says so, with the same plan's checkout open again.
  const returned = search?.get(RETURN_FLAG) === "plan";
  useEffect(() => {
    if (!returned) return;
    const outcome = checkoutOutcome(search);
    const picked = PLANS.find((p) => p.id === readPick());
    if (picked) setPlanId(picked.id);
    if (checkoutProblem(outcome)) {
      setProblem(checkoutProblem(outcome));
      return;
    }
    if (outcome) setPhase("waiting");
    void fetchBilling().then((status) => {
      if (status?.subscribed) finish();
      else if (outcome) waitForIt();
    });
  }, [returned]); // eslint-disable-line react-hooks/exhaustive-deps

  // A checkout that never says it's ready gets an offer to load it again.
  useEffect(() => {
    setLoaded(false);
    setStuck(false);
    if (!plan || sandbox || !plan.planId || phase !== "picking") return undefined;
    const t = setTimeout(() => setStuck(true), LOAD_TIMEOUT);
    return () => clearTimeout(t);
  }, [plan, sandbox, phase, attempt]);

  const pick = (id) => {
    setProblem(null);
    setPlanId(id);
    writePick(id);
  };

  const startSandbox = async () => {
    if (!plan) return;
    setStarting(true);
    setProblem(null);
    try {
      const res = await apiRequest("/api/billing/sandbox-plan", { method: "POST", body: JSON.stringify({ plan_id: plan.id }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.subscribed !== false) return finish();
      setProblem(body?.detail?.code === "not_sandbox"
        ? "This account isn’t a sandbox account, so its plan has to be paid for. Reload the page to see the checkout."
        : "Couldn’t start the plan. Try again.");
    } catch {
      setProblem("Couldn’t reach Birdy. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  };

  const right = (() => {
    if (phase === "waiting") {
      return (
        <div role="status" className="flex flex-col gap-2 rounded-by-lg border border-by-line bg-by-surface p-4 shadow-by-card">
          <span className="inline-flex items-center gap-1.5 text-by-body-sm font-semibold text-by-success"><Check aria-hidden="true" className="size-4" strokeWidth={2.5} />Payment sent</span>
          <span className="inline-flex items-center gap-2 text-by-body text-by-text"><Loader2 aria-hidden="true" className="size-4 text-by-accent motion-safe:animate-spin" />Waiting for the payment to show up</span>
          <p className="text-by-body-sm text-by-muted">{slow ? "This is taking longer than usual. It can take a minute, and setup carries on by itself." : "This usually takes a few seconds."}</p>
        </div>
      );
    }
    if (sandbox) {
      return (
        <div className="flex flex-col gap-3 rounded-by-lg border border-by-line bg-by-surface p-4 shadow-by-card">
          <Pill tone="accent" dot={false} className="self-start">Sandbox account</Pill>
          <p className="text-by-body text-by-text-2">This account runs on generated data, so nothing is charged. The plan starts straight away.</p>
          {problem && <Notice tone="danger">{problem}</Notice>}
          <div>
            <Button kind="primary" disabled={!plan} loading={starting} onClick={startSandbox}>{plan ? `Start ${plan.name}` : "Pick a plan"}</Button>
          </div>
        </div>
      );
    }
    if (PLANS.every((p) => !p.planId)) {
      return <Notice tone="warning">Plans can’t be bought here right now. Write to billing@birdy.ai and we’ll set your plan up.</Notice>;
    }
    if (!plan) {
      return (
        <div className="flex min-h-48 flex-1 items-center justify-center rounded-by-lg border border-dashed border-by-line-strong p-4 text-center text-by-body-sm text-by-muted">
          Pick a plan to see the checkout.
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {problem && <Notice tone="danger">{problem}</Notice>}
        {stuck && !loaded && (
          <Notice tone="warning" action={<Button size="sm" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}>
            The checkout is taking a while to load. Check your connection and try again.
          </Notice>
        )}
        <div className="min-h-72 rounded-by-lg border border-by-line bg-by-surface p-3 shadow-by-card">
          <WhopCheckout
            key={`${plan.id}:${attempt}`}
            planId={plan.planId}
            returnUrl={`${window.location.origin}/welcome?${RETURN_FLAG}=plan`}
            onReady={() => setLoaded(true)}
            onComplete={waitForIt}
            fallback={<CheckoutSkeleton />}
          />
        </div>
      </div>
    );
  })();

  return (
    <div className="@container flex max-w-4xl flex-col gap-3">
      {tooBig && (
        <Notice tone="warning">
          That’s more than any plan holds: Scale covers {PLANS[PLANS.length - 1].maxClients} clients. Once it’s active you can add extra client slots for ${EXTRA_CLIENT_PRICE} a month each in Settings.
        </Notice>
      )}
      <div className="grid gap-3 @2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div role="radiogroup" aria-label="Plans" className="flex flex-col gap-2">
          {PLANS.map((p) => (
            <OptionCard
              key={p.id}
              selected={p.id === planId}
              disabled={phase !== "picking" || !buyable(p)}
              onSelect={() => pick(p.id)}
              className="py-3"
              title={<>{p.name}{fitting?.id === p.id && <Pill tone="accent" dot={false} className="ml-2 align-middle">Fits {plural(fit.count, "client")}</Pill>}</>}
              subtitle={capacity(p)}
              aside={<span className="shrink-0 font-semibold text-by-text tabular-nums">${p.price}/mo</span>}
            />
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-2.5">
          {right}
          {plan && phase === "picking" && (
            <p className="text-by-body-sm text-by-muted">
              {plan.name} · ${plan.price} a month.{sandbox ? " Nothing is charged on a sandbox account." : " Cancel any time in Settings."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
