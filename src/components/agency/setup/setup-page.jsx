"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import getSymbolFromCurrency from "currency-symbol-map";
import { toast } from "sonner";
import { AskBar, Button, Notice, SECTIONS, SectionHeader, Skeleton } from "@/components/by";
import { takeOAuthHandoff } from "@/lib/oauth-handoff";
import { SECTION_ORDER, STEPS, basicsOf, nextStep, pctDone, sectionParam, unlocked, waitsOn } from "@/lib/setup-steps";
import { useSetup } from "@/lib/use-setup";
import { BuyerSetup } from "./buyer-setup";
import { Checklist } from "./checklist";
import { CoachSetup } from "./coach-setup";
import { OpsSetup } from "./ops-setup";
import { useSetupActions } from "./use-setup-actions";

const kit = (id) => SECTIONS.find((s) => s.id === id);
const NAMES = Object.fromEntries(SECTION_ORDER.map((id) => [id, kit(id).name]));
const SEEN_KEY = "birdy_setup_seen";
const FOLD_KEY = "birdy_setup_checklist_folded";

// Per-browser conveniences only (which sections were opened, whether the checklist is folded): nothing here decides a step.
const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
};
const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* fine without it */ }
};

/**
 * Setup (/welcome), in funnel order: Agency Ops, then Media Buyer, then Sales
 * Coach. Each section is set up in its own chat; the checklist sits at the top
 * of Agency Ops'. `?s=` picks the section (a locked one opens Agency Ops),
 * `?checklist=1` unfolds the checklist (the rail's ring links here).
 */
export function SetupPage() {
  const router = useRouter();
  const search = useSearchParams();
  const setup = useSetup();
  const actions = useSetupActions(setup.refresh);
  const { facts, steps, ready } = setup;

  const requested = sectionParam(search.get("s"));
  const open = ready && !unlocked(steps, requested) ? "ops" : requested;
  const section = kit(open);
  const [seen, setSeen] = useState(["ops"]);
  const [folded, setFolded] = useState(false);
  const [finishing, setFinishing] = useState(null);

  // Arriving is what ends an OAuth hop: the return path it parked is spent.
  useEffect(() => { takeOAuthHandoff(); }, []);
  const unfold = search.get("checklist");
  useEffect(() => {
    setSeen(readJson(SEEN_KEY, ["ops"]));
    setFolded(unfold ? false : readJson(FOLD_KEY, false));
  }, [unfold]);
  // Opening a section takes its "New" away.
  useEffect(() => {
    if (!ready) return;
    setSeen((prev) => {
      if (prev.includes(open)) return prev;
      const next = [...prev, open];
      writeJson(SEEN_KEY, next);
      return next;
    });
  }, [open, ready]);
  // Keep the app's own gate in step with the account: unfinished setup holds the app here.
  useEffect(() => {
    if (!facts.onboarding) return;
    try {
      if (facts.onboarding.completed) localStorage.removeItem("onboarding_incomplete");
      else localStorage.setItem("onboarding_incomplete", "1");
    } catch { /* the server copy still decides at next login */ }
  }, [facts.onboarding]);

  const fold = (value) => { setFolded(value); writeJson(FOLD_KEY, value); };

  const clients = facts.clients || [];
  const firstId = facts.onboarding?.data?.first_client?.group_id;
  const firstClient = clients.find((g) => g.id === firstId) ?? clients[0] ?? null;
  const currency = basicsOf(facts.onboarding).currency || "GBP";
  const ctx = {
    facts, steps, actions, names: NAMES, agentName: NAMES.ops, refresh: setup.refresh, firstClient, currency,
    sym: getSymbolFromCurrency(firstClient?.ad_account_currency || currency) || "£",
  };

  const finish = async (to) => {
    setFinishing(to);
    try {
      if (!setup.completed) await actions.complete();
      router.push(to === "buyer" ? "/welcome?s=buyer" : "/dashboard");
    } finally {
      setFinishing(null);
    }
  };

  // A row jumps to its step: in this chat it scrolls there, in another section it opens that section.
  const jump = (id) => {
    const step = STEPS.find((s) => s.id === id);
    if (step.section !== open) return router.push(`/welcome?s=${step.section}`);
    const el = document.getElementById(`step-${id}`) ?? document.getElementById(`step-${nextStep(steps, open)}`);
    el?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  // Each new message scrolls into view (not on arrival, so the checklist is what's seen first).
  const scroller = useRef(null);
  const progress = `${open}:${JSON.stringify(steps)}:${JSON.stringify(facts.onboarding?.data ?? {})}`;
  const last = useRef(null);
  useEffect(() => {
    if (!ready) return;
    if (last.current !== null && last.current !== progress) {
      scroller.current?.scrollTo?.({ top: scroller.current.scrollHeight, behavior: "smooth" });
    }
    last.current = progress;
  }, [progress, ready]);

  const tabs = useMemo(() => SECTION_ORDER.map((id) => {
    const isOpen = !ready || unlocked(steps, id);
    const fresh = ready && isOpen && id !== "ops" && !seen.includes(id);
    return {
      value: id,
      label: NAMES[id],
      disabled: !isOpen,
      hint: `Unlocks after ${NAMES[waitsOn(id)]}`,
      badge: !isOpen ? <Lock aria-hidden="true" /> : fresh ? <span className="rounded-by-sm bg-by-accent px-1.5 py-px text-[10.5px] font-bold text-by-on-accent">New</span> : null,
    };
    // Keyed on the steps' values, not their object: a new object with the same answers mustn't re-measure the pill.
  }), [ready, JSON.stringify(steps), seen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-by-canvas font-by-body text-by-body text-by-text selection:bg-by-accent-line selection:text-by-text">
      <SectionHeader
        section={section}
        subtitle={ready && !setup.failed ? `Setup · ${pctDone(steps)}% done` : "Setup"}
        tabs={tabs}
        tab={open}
        onTabChange={(value) => router.push(`/welcome?s=${value}`)}
        // On a phone the three tabs are wider than the screen: their row scrolls sideways instead of being cut off.
        className="[&>div:nth-child(2)]:min-w-0 [&>div:nth-child(2)]:overflow-x-auto"
      />
      <div ref={scroller} aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-5 px-4 py-6 sm:px-7">
          {setup.failed ? (
            <Notice tone="danger" action={<Button size="sm" onClick={() => setup.refresh()}>Try again</Button>}>Couldn’t load your setup. Check your connection and try again.</Notice>
          ) : !ready ? (
            <div aria-busy="true" aria-label="Loading your setup" className="flex flex-col gap-4">
              <Skeleton className="h-64 w-full rounded-by-lg" />
              <Skeleton className="w-40" /><Skeleton className="w-full" /><Skeleton className="w-3/4" />
            </div>
          ) : (
            <>
              {open === "ops" && <Checklist steps={steps} onJump={jump} folded={folded} onFold={fold} />}
              {open === "ops" && <OpsSetup ctx={ctx} onFinish={finish} finishing={finishing} />}
              {open === "buyer" && <BuyerSetup ctx={ctx} onNext={() => router.push("/welcome?s=coach")} />}
              {open === "coach" && <CoachSetup ctx={ctx} finishing={finishing} onDone={() => finish("app")} />}
            </>
          )}
        </div>
      </div>
      <div className="shrink-0 px-4 pb-5 sm:px-7">
        <div className="mx-auto w-full max-w-[800px]">
          <AskBar placeholder={`Message ${section.name}`} onSubmit={() => toast("Pick one of the options in the chat to carry on")} />
        </div>
      </div>
    </div>
  );
}
