"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button, Notice, OptionCard, Pill, Skeleton } from "@/components/by";
import { PLANS } from "@/components/billing/plans";
import { WHOP_ENVIRONMENT, storedEmail } from "@/components/billing/whop";
import { apiRequest } from "@/lib/api";
import { EXTRA_CLIENT_PRICE } from "@/lib/plan-billing";
import { clientsToFit } from "@/lib/setup-steps";
import { Checklist } from "./checklist";

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

// Whop's script failed to load at all (offline, blocked): say so instead of a blank box.
function CheckoutUnavailable() {
  return (
    <Notice tone="danger" action={<Button size="sm" onClick={() => window.location.reload()}>Reload</Button>}>
      The checkout didn’t load. Check your connection, then reload the page.
    </Notice>
  );
}

const WhopCheckoutEmbed = dynamic(
  () => import("@whop/checkout/react").then((m) => m.WhopCheckoutEmbed).catch(() => CheckoutUnavailable),
  { ssr: false, loading: CheckoutSkeleton },
);

/** How long the embed may take to say it's ready before we offer to load it again. */
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

/**
 * Setup's plan step, a screen of its own while it's the current step (the chat
 * steps aside): the checklist on the left with this step marked Now, and a
 * sheet with the three plans beside the checkout for the one picked. A sandbox
 * account starts a plan without paying. When the subscription is active,
 * `onActive` is called and setup carries on.
 *
 * @param {object} props.facts setup's facts (lib/use-setup), with `billing`
 * @param {Record<string, string>} props.steps
 * @param {boolean} [props.completed] setup was finished before plans were required
 * @param {() => void | Promise<void>} props.onActive
 */
export function PlanStep({ facts, steps, completed = false, onActive }) {
  const search = useSearchParams();
  const billing = facts.billing;
  const sandbox = Boolean(billing?.sandbox);
  const fit = clientsToFit(facts);
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
  const [email, setEmail] = useState("");
  const [stateId, setStateId] = useState(null);
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

  useEffect(() => setEmail(storedEmail()), []);
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
  // the same plan's checkout picks up where it was, and if the plan is already
  // on, setup carries on at once.
  const returned = search?.get(RETURN_FLAG) === "plan" || Boolean(search?.get("state_id"));
  useEffect(() => {
    if (!returned) return;
    const back = search.get("state_id");
    const picked = PLANS.find((p) => p.id === readPick());
    if (picked) setPlanId(picked.id);
    if (back) setStateId(back);
    void fetchBilling().then((status) => { if (status?.subscribed) finish(); });
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

  const lead = completed
    ? "Every account now needs a plan. Everything you set up is kept, and you carry on where you left off once it’s active."
    : sandbox
      ? "Setup carries on as soon as the plan starts."
      : "Setup carries on as soon as the payment goes through.";
  const found = fit && (fit.source === "ghl"
    ? `${plural(fit.count, "sub-account")} found in GoHighLevel.`
    : `You have ${plural(fit.count, "client")} in Birdy.`);

  const right = (() => {
    if (phase === "waiting") {
      return (
        <div role="status" className="flex flex-col gap-2 rounded-by-lg border border-by-line bg-by-canvas p-4">
          <span className="inline-flex items-center gap-1.5 text-by-body-sm font-semibold text-by-success"><Check aria-hidden="true" className="size-4" strokeWidth={2.5} />Payment sent</span>
          <span className="inline-flex items-center gap-2 text-by-body text-by-text"><Loader2 aria-hidden="true" className="size-4 text-by-accent motion-safe:animate-spin" />Waiting for the payment to show up</span>
          <p className="text-by-body-sm text-by-muted">{slow ? "This is taking longer than usual. It can take a minute, and setup carries on by itself." : "This usually takes a few seconds."}</p>
        </div>
      );
    }
    if (sandbox) {
      return (
        <div className="flex flex-col gap-3 rounded-by-lg border border-by-line bg-by-canvas p-4">
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
        {stuck && !loaded && (
          <Notice tone="warning" action={<Button size="sm" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}>
            The checkout is taking a while to load. Check your connection and try again.
          </Notice>
        )}
        <div className="min-h-72 rounded-by-lg border border-by-line bg-by-surface p-3">
          <WhopCheckoutEmbed
            key={`${plan.id}:${attempt}`}
            planId={plan.planId}
            environment={WHOP_ENVIRONMENT}
            theme="light"
            skipRedirect
            returnUrl={`${window.location.origin}/welcome?${RETURN_FLAG}=plan`}
            stateId={stateId ?? undefined}
            prefill={email ? { email } : undefined}
            onStateChange={(state) => { if (state !== "loading") setLoaded(true); }}
            onComplete={waitForIt}
            fallback={<CheckoutSkeleton />}
          />
        </div>
      </div>
    );
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="shrink-0 border-by-line bg-by-surface px-4 py-5 lg:w-80 lg:overflow-y-auto lg:border-r lg:px-4.5">
        <Checklist steps={steps} current="plan" flat />
      </aside>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full items-start justify-center px-4 py-6 sm:px-7 lg:items-center">
          <section aria-labelledby="plan-step-title" id="step-plan" className="flex w-full max-w-[900px] flex-col gap-5 rounded-by-xl border border-by-line bg-by-surface p-5 shadow-by-floating sm:p-7">
            <div>
              <h2 id="plan-step-title" className="font-by-display text-by-title font-semibold text-by-text">Pick your plan</h2>
              <p className="mt-1.5 text-by-body text-by-muted">{found ? `${found} ` : ""}{lead}</p>
            </div>
            {tooBig && (
              <Notice tone="warning">
                That’s more than any plan holds: Scale covers {PLANS[PLANS.length - 1].maxClients} clients. Once it’s active you can add extra client slots for ${EXTRA_CLIENT_PRICE} a month each in Settings.
              </Notice>
            )}
            <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
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
          </section>
        </div>
      </div>
    </div>
  );
}
