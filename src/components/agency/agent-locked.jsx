"use client";

import Link from "next/link";
import { ArrowRight, Check, Circle, Lock } from "lucide-react";
import { Card, buttonVariants, cn } from "@/components/by";
import { AGENT_NAMES, SECTION_OF_AGENT, TEAM_ORDER, nextSection, stepsLeftOf, useTeamSetup } from "@/lib/team-setup";

const JOBS = {
  media_buyer: "It watches your clients’ ads and proposes changes. You approve them.",
  sales_coach: "It watches how fast new leads get called and how many close.",
  sub_agents: "Small helpers the agents run for you on a schedule.",
};

/** One line per agent before this one: ready, or what it still needs. */
function needs(team, agent) {
  const before = TEAM_ORDER.slice(0, Math.max(0, TEAM_ORDER.indexOf(agent)));
  return before.map((key) => {
    const done = team.agents[key].status === "done";
    if (done) return { key, done, text: `${AGENT_NAMES[key]} is ready` };
    if (key === "birdy") return { key, done, text: "Birdy: finish its setup" };
    const left = stepsLeftOf(team, key);
    return { key, done, text: left.length ? `${AGENT_NAMES[key]}: ${left.length} left (${left.join(", ")})` : `${AGENT_NAMES[key]}: not finished` };
  });
}

/**
 * What a locked agent shows instead of its page or its chat: which agent it
 * waits on, what is left, and a way back into setup.
 *
 * @param {"media_buyer"|"sales_coach"|"sub_agents"} props.agent
 * @param {string|null} [props.waitsOn] the agent it waits on, when the caller knows (a 423 says); else read from the team state
 * @param {boolean} [props.compact] inside a chat, rather than as a whole page
 */
export function AgentLocked({ agent, waitsOn = null, compact = false }) {
  const { team } = useTeamSetup();
  const name = AGENT_NAMES[agent] ?? "This agent";
  const waits = waitsOn ?? team?.agents[agent]?.waits_on ?? null;
  const target = team ? nextSection(team) : SECTION_OF_AGENT[waits] ?? "ops";
  const targetAgent = Object.keys(SECTION_OF_AGENT).find((k) => SECTION_OF_AGENT[k] === target);
  const lines = team && agent ? needs(team, agent) : [];

  return (
    <Card
      role="region"
      aria-label={`${name} is locked`}
      className={cn("flex flex-col gap-1 text-left", compact ? "p-4" : "w-full max-w-[430px] p-6 text-center shadow-by-raised")}
    >
      <span aria-hidden="true" className={cn("grid place-items-center rounded-by-lg bg-by-sunken text-by-muted", compact ? "mb-2 size-9 [&>svg]:size-4" : "mx-auto mb-3 size-13 [&>svg]:size-6")}>
        <Lock />
      </span>
      <h2 className={cn("font-by-display font-semibold text-by-text", compact ? "text-by-body-lg" : "text-by-heading")}>{name} isn’t set up yet</h2>
      <p className="text-by-body text-by-muted">
        {JOBS[agent] ? `${JOBS[agent]} ` : ""}
        {waits ? `It unlocks once ${AGENT_NAMES[waits] ?? "the agent before it"} is set up.` : "It unlocks once the agents before it are set up."}
      </p>
      {lines.length > 0 && (
        <ul className="mt-3 flex flex-col text-left">
          {lines.map((l) => (
            <li key={l.key} className="flex items-start gap-2.5 border-t border-by-line py-2 text-by-body-sm text-by-text">
              {l.done
                ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-by-success" strokeWidth={2.5} />
                : <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-by-muted" />}
              <span className="min-w-0">{l.text}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/welcome?s=${target}`} className={cn(buttonVariants({ kind: "primary" }), "mt-3", compact ? "self-start" : "w-full justify-center")}>
        Continue {AGENT_NAMES[targetAgent] ?? "Birdy"} setup<ArrowRight aria-hidden="true" />
      </Link>
    </Card>
  );
}

/**
 * Gates a locked agent's pages: every route under its section shows the
 * locked card instead. When the team state can't be read the page shows as before.
 */
export function AgentGate({ agent, children }) {
  const { team, ready } = useTeamSetup();
  // A moment's blank canvas rather than a flash of the page before its lock.
  if (!ready) return <div aria-busy="true" className="min-h-0 flex-1 bg-by-canvas" />;
  if (team?.agents[agent]?.status !== "locked") return children;
  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto bg-by-canvas px-4 py-8 font-by-body">
      <AgentLocked agent={agent} />
    </div>
  );
}
