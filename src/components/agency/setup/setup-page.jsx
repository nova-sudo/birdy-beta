"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Bot } from "lucide-react";
import getSymbolFromCurrency from "currency-symbol-map";
import { toast } from "sonner";
import { AskBar, Button, Notice, SECTIONS, SectionHeader, Skeleton } from "@/components/by";
import { isActive } from "@/lib/client-status";
import { takeOAuthHandoff } from "@/lib/oauth-handoff";
import { setSetupLock } from "@/lib/session";
import { allDone, basicsOf, callingTool, nextStep, pctDone, planIsCurrent, sectionParam, setupHolds } from "@/lib/setup-steps";
import { AGENT_OF_SECTION, answered, nextSection, useTeamSetup } from "@/lib/team-setup";
import { useSetup } from "@/lib/use-setup";
import { SetupCelebration } from "./celebration";
import { Checklist } from "./checklist";
import { AgentInterview } from "./interview/interview";
import { OpsSetup } from "./ops-setup";
import { SubAgentsStep } from "./sub-agents-step";
import { TeamRail } from "./team-rail";
import { useSetupActions } from "./use-setup-actions";

const SUBS = { id: "subs", name: "Sub-agents", description: "Helpers for your agents", icon: Bot, tile: "bg-by-sunken text-by-text-2" };
const kit = (id) => (id === "subs" ? SUBS : SECTIONS.find((s) => s.id === id));
const NAMES = { ops: kit("ops").name, buyer: kit("buyer").name, coach: kit("coach").name, subs: SUBS.name };
/** Agency Ops' celebration shows once per account: this browser remembers it was shown. */
const CELEBRATED_KEY = "birdy_ops_celebrated";
const accountKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return `${CELEBRATED_KEY}:${user?.id ?? user?.email ?? "me"}`;
  } catch {
    return `${CELEBRATED_KEY}:me`;
  }
};
const celebrated = () => {
  try { return localStorage.getItem(accountKey()) === "1"; } catch { return false; }
};
const rememberCelebrated = () => {
  try { localStorage.setItem(accountKey(), "1"); } catch { /* it may show again; nothing breaks */ }
};
const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Bring the chat's newest message into view, the way a chat does: scroll down
 * until its top is near the top or the chat's end is in view, whichever comes
 * first. Never scrolls up.
 */
function revealLatest(scroller, behavior) {
  const latest = scroller?.firstElementChild?.lastElementChild;
  if (!latest) return;
  const top = latest.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 24;
  const target = Math.min(scroller.scrollHeight - scroller.clientHeight, top);
  if (target > scroller.scrollTop) scroller.scrollTo?.({ top: target, behavior: reduceMotion() ? "auto" : behavior });
}

/** What Agency Ops now has in place, for the celebration: only what the account really holds. */
function setUpLines(facts) {
  const lines = [];
  const n = (facts.clients || []).length;
  if (n) lines.push(n === 1 ? "1 client in Birdy" : `${n} clients in Birdy`);
  const tool = callingTool(facts);
  lines.push(tool === "hp" ? "Meta, GoHighLevel and Hot Prospector connected" : "Meta and GoHighLevel connected");
  const channel = facts.slack?.notify_channel_name || facts.onboarding?.data?.slack?.channel_name;
  if (channel) lines.push(`Alerts and reports go to #${channel}`);
  return lines;
}

/**
 * Setup (/welcome), in order: Birdy's own setup chat, then Media Buyer's and
 * Sales Coach's interviews, then sub-agents. "Your team" on the left shows
 * each as done, current or locked; the server's team state decides which is
 * open. `?s=` picks one (a locked one opens the next one to do), `?checklist=1`
 * opens Birdy's checklist on a phone (the rail's ring links here; on a wide
 * screen it's always beside the chat). Without the team state (the request
 * failed) only Birdy's setup shows. The plan is a step in Birdy's chat; an
 * account that finished setup before plans were required is held there until
 * it has one.
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
  // A finished account without a plan has only the plan to do: Birdy's section shows it, whatever `?s=` asks for.
  const planFirst = ready && setup.completed && steps.plan !== "done";
  const open = planFirst || !team ? "ops" : team.agents[AGENT_OF_SECTION[requested]].status === "locked" ? nextSection(team) : requested;
  const waitingForTeam = requested !== "ops" && !teamSetup.ready && !planFirst;
  const section = kit(open);
  const [listOpen, setListOpen] = useState(false);
  const [finishing, setFinishing] = useState(null);
  const [celebrating, setCelebrating] = useState(false);

  // Arriving is what ends an OAuth hop: the return path it parked is spent.
  useEffect(() => { takeOAuthHandoff(); }, []);
  const unfold = search.get("checklist");
  useEffect(() => { if (unfold) setListOpen(true); }, [unfold]);
  // Keep the app's own gate in step with the account: unfinished setup, or no plan, holds the app here.
  const holds = ready ? setupHolds(facts.onboarding, steps) : null;
  useEffect(() => {
    if (holds !== null && facts.onboarding) setSetupLock(holds);
  }, [holds, facts.onboarding]);

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

  // The plan is on: setup carries on in the chat, or, for an account that had
  // finished setup already, the app opens where finished setup goes.
  const planActive = async () => {
    await Promise.all([setup.refresh("billing"), setup.refresh("onboarding")]);
    if (setup.completed) {
      setSetupLock(false);
      router.push("/dashboard");
    }
  };
  const planNow = open === "ops" && ready && !setup.failed && planIsCurrent(steps, setup.completed);

  // A checklist row scrolls to its step in Birdy's chat.
  const jump = (id) => {
    const el = document.getElementById(`step-${id}`) ?? document.getElementById(`step-${nextStep(steps)}`);
    el?.scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" });
  };

  // The chat stays put while an answer saves. When the answer lands, the next
  // message scrolls gently into view. Arriving (a first visit, or back from
  // Meta, GoHighLevel, Slack or the checkout) lands at the step being done.
  const scroller = useRef(null);
  const progress = `${open}:${JSON.stringify(steps)}:${JSON.stringify(facts.onboarding?.data ?? {})}`;
  const last = useRef(null);
  const showsChat = open === "ops" && ready && !setup.failed;
  useEffect(() => {
    if (!showsChat || last.current === progress) return undefined;
    const arriving = last.current === null;
    last.current = progress;
    const frame = requestAnimationFrame(() => revealLatest(scroller.current, arriving ? "auto" : "smooth"));
    return () => cancelAnimationFrame(frame);
  }, [progress, showsChat]);

  // The moment Agency Ops' last step is done (not a visit to a finished
  // setup), it's celebrated, once per account.
  const opsDone = showsChat && !setup.completed && allDone(steps);
  const wasDone = useRef(null);
  useEffect(() => {
    if (!showsChat) return;
    if (wasDone.current === false && opsDone && !celebrated()) {
      rememberCelebrated();
      setCelebrating(true);
    }
    wasDone.current = opsDone;
  }, [opsDone, showsChat]);

  const subtitle = (() => {
    if (open === "ops") return ready && !setup.failed ? `Setup · ${pctDone(steps)}% done` : "Setup";
    if (!team) return "Setup";
    if (open === "subs") return team.agents.sub_agents.status === "done" ? "Setup · done" : "Setup · last step";
    const n = answered(team, AGENT_OF_SECTION[open]);
    return `Setup · ${n.done} of ${n.total} answered`;
  })();

  const loading = (
    <div aria-busy="true" aria-label="Loading your setup" className="flex w-full flex-col gap-4 px-4 py-6 sm:px-7">
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
            <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
              {showsChat && <Checklist steps={steps} onJump={jump} open={listOpen} onOpenChange={setListOpen} />}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div ref={scroller} aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <div className="flex w-full flex-col gap-5 px-4 py-6 sm:px-7">
                    {setup.failed ? (
                      <Notice tone="danger" action={<Button size="sm" onClick={() => setup.refresh()}>Try again</Button>}>Couldn’t load your setup. Check your connection and try again.</Notice>
                    ) : !ready ? loading : (
                      <OpsSetup ctx={ctx} onFinish={finish} onPlanActive={planActive} finishing={finishing} completed={setup.completed} withTeam={Boolean(team)} />
                    )}
                  </div>
                </div>
                <div className="shrink-0 px-4 pb-5 sm:px-7">
                  <div className="w-full">
                    <AskBar
                      placeholder={`Message ${NAMES.ops}`}
                      onSubmit={() => toast(planNow ? "Pick a plan in the chat to carry on" : "Pick one of the options in the chat to carry on")}
                    />
                  </div>
                </div>
              </div>
              <SetupCelebration
                open={celebrating}
                onOpenChange={setCelebrating}
                title={`${NAMES.ops} is set up`}
                done={setUpLines(facts)}
                primary={team
                  ? { label: <>Set up {NAMES.buyer}<ArrowRight aria-hidden="true" /></>, onClick: () => finish("buyer"), loading: finishing === "buyer", disabled: Boolean(finishing) }
                  : { label: `Open ${NAMES.ops}`, onClick: () => finish("app"), loading: finishing === "app", disabled: Boolean(finishing) }}
                secondary={team ? { label: `Open ${NAMES.ops}`, onClick: () => finish("app"), loading: finishing === "app", disabled: Boolean(finishing) } : undefined}
              >
                {team
                  ? `Your first agent is ready. It knows your clients, tools and targets, and it starts watching them now. ${NAMES.buyer} is next.`
                  : "Your first agent is ready. It knows your clients, tools and targets, and it starts watching them now."}
              </SetupCelebration>
            </div>
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
