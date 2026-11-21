"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot } from "lucide-react";
import getSymbolFromCurrency from "currency-symbol-map";
import { toast } from "sonner";
import { AskBar, Button, Notice, SECTIONS, SectionHeader, Skeleton } from "@/components/by";
import { isActive } from "@/lib/client-status";
import { takeOAuthHandoff } from "@/lib/oauth-handoff";
import { basicsOf, nextStep, pctDone, sectionParam } from "@/lib/setup-steps";
import { AGENT_OF_SECTION, answered, nextSection, useTeamSetup } from "@/lib/team-setup";
import { useSetup } from "@/lib/use-setup";
import { Checklist } from "./checklist";
import { AgentInterview } from "./interview/interview";
import { OpsSetup } from "./ops-setup";
import { SubAgentsStep } from "./sub-agents-step";
import { TeamRail } from "./team-rail";
import { useSetupActions } from "./use-setup-actions";

const SUBS = { id: "subs", name: "Sub-agents", description: "Helpers for your agents", icon: Bot, tile: "bg-by-sunken text-by-text-2" };
const kit = (id) => (id === "subs" ? SUBS : SECTIONS.find((s) => s.id === id));
const NAMES = { ops: kit("ops").name, buyer: kit("buyer").name, coach: kit("coach").name, subs: SUBS.name };
const FOLD_KEY = "birdy_setup_checklist_folded";

// Per-browser conveniences only (whether the checklist is folded): nothing here decides a step.
const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
};
const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* fine without it */ }
};

/**
 * Setup (/welcome), in order: Birdy's own setup chat, then Media Buyer's and
 * Sales Coach's interviews, then sub-agents. "Your team" on the left shows
 * each as done, current or locked; the server's team state decides which is
 * open. `?s=` picks one (a locked one opens the next one to do), `?checklist=1`
 * unfolds Birdy's checklist (the rail's ring links here). Without the team
 * state (the request failed) only Birdy's setup shows.
 */
export function SetupPage() {
  const router = useRouter();
  const search = useSearchParams();
  const setup = useSetup();
  const actions = useSetupActions(setup.refresh);
  const teamSetup = useTeamSetup();
  const { team } = teamSetup;
  const { facts, steps, ready } = setup;

  const requested = sectionParam(search.get("s"));
  const open = !team ? "ops" : team.agents[AGENT_OF_SECTION[requested]].status === "locked" ? nextSection(team) : requested;
  const waitingForTeam = requested !== "ops" && !teamSetup.ready;
  const section = kit(open);
  const [folded, setFolded] = useState(false);
  const [finishing, setFinishing] = useState(null);

  // Arriving is what ends an OAuth hop: the return path it parked is spent.
  useEffect(() => { takeOAuthHandoff(); }, []);
  const unfold = search.get("checklist");
  useEffect(() => {
    setFolded(unfold ? false : readJson(FOLD_KEY, false));
  }, [unfold]);
  // Keep the app's own gate in step with the account: unfinished setup holds the app here.
  useEffect(() => {
    if (!facts.onboarding) return;
    try {
      if (facts.onboarding.completed) localStorage.removeItem("onboarding_incomplete");
      else localStorage.setItem("onboarding_incomplete", "1");
    } catch { /* the server copy still decides at next login */ }
  }, [facts.onboarding]);

  const fold = (value) => { setFolded(value); writeJson(FOLD_KEY, value); };
  const go = (to) => router.push(`/welcome?s=${to}`);

  const clients = facts.clients || [];
  const firstId = facts.onboarding?.data?.first_client?.group_id;
  const firstClient = clients.find((g) => g.id === firstId) ?? clients[0] ?? null;
  const currency = basicsOf(facts.onboarding).currency || "GBP";
  const ctx = {
    facts, steps, actions, names: NAMES, agentName: NAMES.ops, refresh: setup.refresh, firstClient, currency,
    sym: getSymbolFromCurrency(firstClient?.ad_account_currency || currency) || "£",
  };
  const active = useMemo(() => clients.filter(isActive), [clients]);
  const interviewCtx = useMemo(() => ({ clients: active, clientsLoading: !ready, currency }), [active, ready, currency]);

  const finish = async (to) => {
    setFinishing(to);
    try {
      if (!setup.completed) await actions.complete();
      // Finishing Birdy opens Media Buyer on the server.
      await teamSetup.refresh();
      router.push(to === "buyer" ? "/welcome?s=buyer" : "/dashboard");
    } finally {
      setFinishing(null);
    }
  };

  // A checklist row scrolls to its step in Birdy's chat.
  const jump = (id) => {
    const el = document.getElementById(`step-${id}`) ?? document.getElementById(`step-${nextStep(steps)}`);
    el?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  // Each new message in Birdy's chat scrolls into view (not on arrival, so the checklist is what's seen first).
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

  const subtitle = (() => {
    if (open === "ops") return ready && !setup.failed ? `Setup · ${pctDone(steps)}% done` : "Setup";
    if (!team) return "Setup";
    if (open === "subs") return team.agents.sub_agents.status === "done" ? "Setup · done" : "Setup · last step";
    const n = answered(team, AGENT_OF_SECTION[open]);
    return `Setup · ${n.done} of ${n.total} answered`;
  })();

  const loading = (
    <div aria-busy="true" aria-label="Loading your setup" className="mx-auto flex w-full max-w-[800px] flex-col gap-4 px-4 py-6 sm:px-7">
      <Skeleton className="h-64 w-full rounded-by-lg" />
      <Skeleton className="w-40" /><Skeleton className="w-full" /><Skeleton className="w-3/4" />
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-by-canvas font-by-body text-by-body text-by-text selection:bg-by-accent-line selection:text-by-text">
      <SectionHeader section={section} subtitle={subtitle} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {team && <TeamRail team={team} open={open} onOpen={go} />}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {waitingForTeam ? loading : open === "ops" ? (
            <>
              <div ref={scroller} aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="mx-auto flex w-full max-w-[800px] flex-col gap-5 px-4 py-6 sm:px-7">
                  {setup.failed ? (
                    <Notice tone="danger" action={<Button size="sm" onClick={() => setup.refresh()}>Try again</Button>}>Couldn’t load your setup. Check your connection and try again.</Notice>
                  ) : !ready ? loading : (
                    <>
                      <Checklist steps={steps} onJump={jump} folded={folded} onFold={fold} />
                      <OpsSetup ctx={ctx} onFinish={finish} finishing={finishing} withTeam={Boolean(team)} />
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0 px-4 pb-5 sm:px-7">
                <div className="mx-auto w-full max-w-[800px]">
                  <AskBar placeholder={`Message ${NAMES.ops}`} onSubmit={() => toast("Pick one of the options in the chat to carry on")} />
                </div>
              </div>
            </>
          ) : open === "subs" ? (
            <SubAgentsStep team={team} onApply={teamSetup.apply} onDone={() => router.push("/dashboard")} />
          ) : (
            <AgentInterview
              key={open}
              agent={AGENT_OF_SECTION[open]}
              team={team}
              onApply={teamSetup.apply}
              onNext={() => go(open === "buyer" ? "coach" : "subs")}
              ctx={interviewCtx}
            />
          )}
        </div>
      </div>
    </div>
  );
}
