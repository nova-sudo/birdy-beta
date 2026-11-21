"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Check, Loader2 } from "lucide-react";
import { Button, Notice, OptionCard, Skeleton } from "@/components/by";
import { PLANS } from "@/components/billing/plans";
import { apiRequest } from "@/lib/api";

const WhopCheckoutEmbed = dynamic(() => import("@whop/checkout/react").then((m) => m.WhopCheckoutEmbed), { ssr: false });
const WHOP_ENVIRONMENT = (process.env.NEXT_PUBLIC_WHOP_ENVIRONMENT ?? "production") === "sandbox" ? "sandbox" : "production";

/** Is there an active subscription? False when we can't tell. */
export async function isSubscribed() {
  try {
    const res = await apiRequest("/api/billing/status");
    if (!res.ok) return false;
    return Boolean((await res.json())?.subscribed);
  } catch {
    return false;
  }
}

function storedEmail() {
  try {
    return JSON.parse(localStorage.getItem("user"))?.email ?? "";
  } catch {
    return "";
  }
}

/**
 * Pick a plan and pay in Whop's embedded checkout, then wait for the
 * subscription to show as active. Every client after the first needs one.
 *
 * @param {number} props.wanted how many clients they're about to bring in, to suggest the plan that fits
 * @param {() => void} props.onSubscribed
 */
export function PlanPicker({ wanted = 1, onSubscribed }) {
  const fits = (PLANS.find((p) => wanted <= p.maxClients) || PLANS[PLANS.length - 1]).id;
  const [plan, setPlan] = useState(null);
  const [phase, setPhase] = useState("picking"); // picking | activating
  const [slow, setSlow] = useState(false);
  const [email, setEmail] = useState("");
  const timer = useRef(null);
  useEffect(() => setEmail(storedEmail()), []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Whop's activation takes seconds; keep checking, more slowly, until it lands.
  const waitForIt = useCallback(() => {
    setPhase("activating");
    const delays = [1500, 3000, 5000, 8000, 12000];
    let tries = 0;
    const tick = async () => {
      if (await isSubscribed()) return onSubscribed();
      tries += 1;
      if (tries >= delays.length) setSlow(true);
      timer.current = setTimeout(tick, delays[Math.min(tries, delays.length - 1)]);
    };
    timer.current = setTimeout(tick, delays[0]);
  }, [onSubscribed]);

  if (phase === "activating") {
    return (
      <div role="status" className="flex max-w-xl flex-col gap-2 rounded-by-lg border border-by-line bg-by-surface p-4 shadow-by-card">
        <span className="inline-flex items-center gap-1.5 text-by-body-sm font-semibold text-by-success"><Check aria-hidden="true" className="size-4" strokeWidth={2.5} />Payment received</span>
        <span className="inline-flex items-center gap-2 text-by-body"><Loader2 aria-hidden="true" className="size-4 text-by-accent motion-safe:animate-spin" />Turning your plan on…</span>
        <p className="text-by-body-sm text-by-muted">{slow ? "Still waiting on it to switch on. This can take a minute; it carries on by itself." : "This usually takes a few seconds."}</p>
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-2.5">
      {!plan ? (
        <div role="radiogroup" aria-label="Plan" className="flex flex-col gap-2">
          {PLANS.map((p) => (
            <OptionCard
              key={p.id}
              selected={false}
              disabled={!p.planId}
              onSelect={() => setPlan(p)}
              title={<>{p.name} · ${p.price}/mo</>}
              subtitle={`Up to ${p.maxClients} clients`}
              aside={p.id === fits ? <span className="rounded-by-sm bg-by-accent-soft px-1.5 py-0.5 text-by-caption font-semibold text-by-accent">Fits you</span> : null}
            />
          ))}
        </div>
      ) : (
        <>
          <p className="text-by-body-sm text-by-text-2"><b className="text-by-text">{plan.name}</b> · ${plan.price}/mo</p>
          <div className="rounded-by-lg border border-by-line bg-by-surface p-3 shadow-by-card">
            <WhopCheckoutEmbed
              planId={plan.planId}
              environment={WHOP_ENVIRONMENT}
              theme="light"
              skipRedirect
              returnUrl={`${window.location.origin}/welcome`}
              prefill={email ? { email } : undefined}
              onComplete={waitForIt}
              fallback={<div className="flex flex-col gap-2.5 py-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-11 w-full" /></div>}
            />
          </div>
          <div><Button kind="ghost" size="sm" onClick={() => setPlan(null)}>Choose a different plan</Button></div>
        </>
      )}
      {PLANS.every((p) => !p.planId) && <Notice tone="warning" action={<Button size="sm" onClick={() => window.location.assign("/billing")}>Open Billing</Button>}>Plans can’t be bought here right now. Subscribe from Billing, then come back.</Notice>}
    </div>
  );
}
