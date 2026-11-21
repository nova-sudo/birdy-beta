"use client";

import { useEffect, useRef } from "react";
import { Bot, Check, Lock } from "lucide-react";
import { AgentAvatar, BirdyAvatar, cn } from "@/components/by";
import { agentInfo } from "@/lib/agent-route";
import { AGENT_NAMES, SECTION_OF_AGENT, TEAM_ORDER, answered } from "@/lib/team-setup";

const TILE = "grid size-8 shrink-0 place-items-center rounded-by-md [&>svg]:size-4";

function Face({ agent, locked }) {
  if (agent === "birdy") return <BirdyAvatar size={32} />;
  if (locked) return <span aria-hidden="true" className={cn(TILE, "bg-by-sunken text-by-muted")}><Lock /></span>;
  if (agent === "sub_agents") return <span aria-hidden="true" className={cn(TILE, "bg-by-sunken text-by-text-2")}><Bot /></span>;
  return <AgentAvatar info={agentInfo(agent)} size={32} />;
}

/** The line under an agent's name: Ready, how far its interview is, or Locked. */
export function teamLine(team, agent) {
  const a = team.agents[agent];
  if (a.status === "locked") return { text: "Locked", tone: "muted" };
  if (a.status === "done") return { text: agent === "sub_agents" && a.skipped ? "Skipped for now" : "Ready", tone: "done" };
  if (agent === "birdy") return { text: "Setting up", tone: "now" };
  if (agent === "sub_agents") return { text: "Last step", tone: "now" };
  const n = answered(team, agent);
  return { text: `${n.done} of ${n.total} answered`, tone: "now" };
}

/**
 * "Your team" (option C): each agent in setup order, done, current or locked.
 * A locked one can't be opened yet. At phone width it is a strip across the top.
 *
 * @param {object} props.team the normalized team state
 * @param {string} props.open the open /welcome section
 * @param {(section: string) => void} props.onOpen
 */
export function TeamRail({ team, open, onOpen }) {
  // On a phone the strip scrolls sideways: keep the open agent in view.
  const nav = useRef(null);
  useEffect(() => {
    const strip = nav.current;
    const item = strip?.querySelector("[aria-current=step]");
    if (!strip || !item || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollLeft = item.offsetLeft - (strip.clientWidth - item.offsetWidth) / 2;
  }, [open]);
  return (
    <nav
      ref={nav}
      aria-label="Your team"
      className={cn(
        "flex shrink-0 gap-1 border-by-line bg-by-surface",
        // Phone: one row that scrolls inside itself. Wide: a column on the left.
        "overflow-x-auto overscroll-x-contain border-b px-3 py-2",
        "lg:w-56 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-3 lg:py-5",
      )}
    >
      <p className="hidden px-2.5 pb-2 text-by-caption font-semibold tracking-[0.04em] text-by-muted uppercase lg:block">Your team</p>
      {TEAM_ORDER.map((agent) => {
        const section = SECTION_OF_AGENT[agent];
        const locked = team.agents[agent].status === "locked";
        const line = teamLine(team, agent);
        const current = section === open;
        const waits = team.agents[agent].waits_on;
        return (
          <button
            key={agent}
            type="button"
            disabled={locked}
            aria-current={current ? "step" : undefined}
            title={locked && waits ? `Unlocks after ${AGENT_NAMES[waits]}` : undefined}
            onClick={() => onOpen(section)}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-2.5 rounded-by-lg px-2.5 py-2 text-left transition-colors duration-(--by-dur-fast) ease-by-out",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent disabled:cursor-default",
              current ? "bg-by-accent-soft" : "hover:bg-by-canvas disabled:hover:bg-transparent",
            )}
          >
            <Face agent={agent} locked={locked} />
            <span className="min-w-0">
              <b className={cn("block truncate font-by-body text-by-body font-semibold", locked ? "text-by-muted" : "text-by-text")}>{AGENT_NAMES[agent]}</b>
              {line.tone === "done" ? (
                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-by-success-bg px-2 py-px text-by-caption font-semibold text-by-success">
                  <Check aria-hidden="true" className="size-3" strokeWidth={3} />{line.text}
                </span>
              ) : (
                <span className={cn("block truncate text-by-body-sm", line.tone === "now" && current ? "text-by-accent" : "text-by-muted")}>{line.text}</span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
