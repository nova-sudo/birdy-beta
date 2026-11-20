"use client";

// "Waiting for your approval" at the top of Media Buyer's and Sales Coach's
// Suggestions: every change proposed in their area, from a chat or a
// sub-agent's run, with the same approval card the chat shows.

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Bot, Clock, MessageSquare } from "lucide-react";
import { Button, CountBadge, Notice, Skeleton, Card } from "@/components/by";
import { ReplyProposals } from "@/components/agency/chat/proposal-card";
import { AGENTS, subAgentContextHref } from "@/lib/agent-route";
import { fetcher } from "@/lib/fetcher";
import { usePendingProposals } from "@/lib/proposals-api";
import { useSubAgents } from "@/lib/sub-agents";

/**
 * Where a proposal came from, as words and a link: the chat it was made in (opened in the chat of
 * the agent that conversation is with), or the sub-agent whose run made it. Only what the server
 * says is used; a missing name stays generic.
 *
 * @param {object} proposal a normalized proposal
 * @param {Map<string, {agent?: string, title?: string}>} chats saved conversations by session id
 * @param {Map<string, string>} subNames sub-agent names by id
 * @param {"media_buyer"|"sales_coach"} parent whose area this is
 */
export function originOf(proposal, chats, subNames, parent) {
  if (proposal.origin === "sub_agent_run") {
    const name = proposal.sub_agent_name || subNames.get(proposal.sub_agent_id) || null;
    return {
      kind: "run",
      text: name ? `From ${name}’s run` : "From a sub-agent’s run",
      href: proposal.sub_agent_id ? subAgentContextHref(parent, proposal.sub_agent_id) : null,
      link: name ? `See ${name}` : "See it in Context",
    };
  }
  if (proposal.origin === "chat" || proposal.session_id) {
    const chat = proposal.session_id ? chats.get(proposal.session_id) : null;
    const base = AGENTS[chat?.agent]?.chat ?? AGENTS.birdy.chat;
    return {
      kind: "chat",
      text: chat?.title ? `From your chat “${chat.title}”` : "From a chat",
      href: proposal.session_id ? `${base}?c=${encodeURIComponent(proposal.session_id)}` : null,
      link: "Open the chat",
    };
  }
  return null;
}

function Origin({ origin }) {
  if (!origin) return null;
  const Icon = origin.kind === "run" ? Bot : MessageSquare;
  return (
    <p className="mb-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-by-caption text-by-muted">
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{origin.text}</span>
      {origin.href && <Link href={origin.href} className="font-semibold text-by-accent hover:underline">{origin.link}</Link>}
    </p>
  );
}

/**
 * The pending group. Hidden while there is nothing waiting, and when the server has no list of
 * pending proposals yet. A decision made here stays on screen until the list is next read.
 *
 * @param {"media_buyer"|"sales_coach"} props.agent
 * @param {string|null} [props.clientId] only proposals about this client
 */
export function PendingProposals({ agent, clientId = null }) {
  const { proposals, unavailable, error, isLoading, mutate } = usePendingProposals(agent);
  const { subAgents } = useSubAgents(agent);
  // Saved conversations, to name the chat a proposal came from (the same list the Chat tab reads).
  const { data: convo } = useSWR(proposals.some((p) => p.session_id) ? "/api/chat/conversations" : null, fetcher);
  // Decisions made here: {id: {base, patch}}. `base` is the proposal as listed, so where it came
  // from still reads right after approving puts the owning agent's chat on it.
  const [decided, setDecided] = useState({});

  const chats = useMemo(() => new Map((convo?.conversations ?? []).map((c) => [c.session_id, c])), [convo]);
  const subNames = useMemo(() => new Map(subAgents.map((s) => [s.id, s.name])), [subAgents]);
  const shown = useMemo(() => {
    const mine = clientId ? proposals.filter((p) => !p.client_group_id || p.client_group_id === clientId) : proposals;
    // Ones decided here stay, in their decided state, until the page is left.
    const kept = Object.values(decided).map((d) => d.base).filter((p) => !mine.some((m) => m.id === p.id));
    return [...mine, ...kept].map((base) => ({ base, proposal: { ...base, ...decided[base.id]?.patch } }));
  }, [proposals, decided, clientId]);
  const waiting = shown.filter(({ proposal }) => proposal.status === "pending").length;

  if (unavailable || (!isLoading && !error && shown.length === 0)) return null;

  const update = (base) => (id, patch) => {
    setDecided((d) => ({ ...d, [id]: { base: d[id]?.base ?? base, patch: { ...d[id]?.patch, ...patch } } }));
    if (patch.status && patch.status !== "pending") mutate();
  };
  // A sub-agent's proposal is said to come from it by name, when the list of sub-agents has it.
  const named = (p) => (p.proposed_by_name || !String(p.proposed_by ?? "").startsWith("sub:") ? p : { ...p, proposed_by_name: subNames.get(p.proposed_by.slice(4)) ?? null });

  return (
    <section aria-labelledby="pending-heading" className="mb-6">
      <div className="flex items-center gap-2">
        <Clock aria-hidden="true" className="size-4 text-by-warning" />
        <h2 id="pending-heading" className="font-by-display text-by-body-lg font-semibold">Waiting for your approval</h2>
        {waiting > 0 && <CountBadge aria-label={`${waiting} waiting`}>{waiting}</CountBadge>}
      </div>
      <p className="mt-0.5 text-by-body-sm text-by-text-2">Changes proposed in chats and by sub-agents. Nothing changes until you approve it.</p>
      {error ? (
        <Notice className="mt-3" tone="danger" action={<Button size="sm" onClick={() => mutate()}>Retry</Button>}>Couldn’t load what is waiting for you. Check your connection and try again.</Notice>
      ) : isLoading ? (
        <div aria-busy="true" aria-label="Loading proposals" className="mt-3"><Card className="px-4 py-4"><Skeleton className="w-56" /><Skeleton className="mt-3 w-80 max-w-full" /></Card></div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3.5">
          {shown.map(({ base, proposal }) => (
            <li key={base.id}>
              <Origin origin={originOf(base, chats, subNames, agent)} />
              <ReplyProposals proposals={[named(proposal)]} onUpdate={update(base)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
