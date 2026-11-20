"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Clock, Undo2, X } from "lucide-react";
import { AgentAvatar, Button, Card, Notice, Pill, cn } from "@/components/by";
import { AGENTS, agentInfo } from "@/lib/agent-route";
import { SUB_AGENT_KIND, applyProposal, dismissProposal, proposalErrorMessage, receiptLine, undoErrorMessage, undoProposal } from "@/lib/proposals-api";
import { rememberSectionChat } from "@/lib/section-chats";
import { SubAgentProposal } from "./sub-agent-proposal";

const SECTION_OF = { birdy: "ops", media_buyer: "buyer", sales_coach: "coach" };

/** The address of the owning agent's own chat, opened on the conversation the change went to. */
export function ownerChatHref(agent, sessionId, clientId) {
  const base = AGENTS[agent]?.chat ?? AGENTS.birdy.chat;
  const q = new URLSearchParams();
  if (clientId) q.set("client", clientId);
  if (sessionId) q.set("c", sessionId);
  const query = q.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * A change another agent proposed, under the reply that explains it (option A1): who proposes it,
 * what it is, Approve or Decline, and who will make it. Once decided it shrinks to one line.
 * Approving hands the change to the agent that owns the area, in its own chat.
 *
 * An approved change the server can take back (`can_undo`) offers Undo; the owning agent undoes it
 * in its own chat, or the server says why it can't any more.
 *
 * @param {object} props.proposal {id, agent, title, detail, kind, payload, status, can_undo, proposed_by, client_group_id}
 * @param {(patch: object) => void} [props.onUpdate] keeps the decision on the reply
 */
export function ProposalCard({ proposal, onUpdate }) {
  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState(null);
  const owner = agentInfo(proposal.agent);
  // A main agent by its key; a sub-agent ("sub:<id>") only when its name came with the proposal.
  const by = AGENTS[proposal.proposed_by]
    ? agentInfo(proposal.proposed_by)
    : String(proposal.proposed_by ?? "").startsWith("sub:") && proposal.proposed_by_name
      ? agentInfo(proposal.proposed_by, { name: proposal.proposed_by_name, parent: proposal.agent })
      : owner;
  // Undone is an approved change taken back; expired is one that lapsed before a decision.
  const status = ["approved", "dismissed", "undone", "expired"].includes(proposal.status) ? proposal.status : "pending";
  const title = proposal.title || "A proposed change";

  const decide = async (what) => {
    setBusy(what);
    setFailure(null);
    try {
      if (what === "undo") {
        const res = await undoProposal(proposal.id);
        onUpdate?.({ undone: true, can_undo: false, undo_receipt: receiptLine(res?.reply), session_id: res?.session_id ?? proposal.session_id ?? null });
      } else if (what === "approve") {
        const res = await applyProposal(proposal.id);
        const sessionId = res?.session_id ?? null;
        if (sessionId && SECTION_OF[proposal.agent] && proposal.agent !== "birdy") rememberSectionChat(SECTION_OF[proposal.agent], sessionId);
        onUpdate?.({ status: "approved", session_id: sessionId ?? proposal.session_id ?? null, receipt: receiptLine(res?.reply) });
      } else {
        await dismissProposal(proposal.id);
        onUpdate?.({ status: "dismissed" });
      }
    } catch (err) {
      setFailure({ err, what });
    } finally {
      setBusy(null);
    }
  };

  if (status !== "pending") {
    const approved = status === "approved" || status === "undone";
    const undone = status === "undone" || (approved && proposal.undone === true);
    const expired = status === "expired";
    const canUndo = approved && !undone && proposal.can_undo === true;
    return (
      <Card className={cn("flex flex-col gap-2 px-3.5 py-3", (!approved || undone) && "opacity-[0.62]")}>
        <div className="flex items-center gap-2 text-by-body-sm">
          <AgentAvatar info={owner} />
          <b className="min-w-0 flex-1 font-semibold">{title}</b>
          {status === "dismissed" && <Pill tone="neutral" dot={false}><X aria-hidden="true" className="size-3" />Declined</Pill>}
          {expired && <Pill tone="neutral" dot={false}><Clock aria-hidden="true" className="size-3" />Lapsed</Pill>}
          {undone && <Pill tone="neutral" dot={false}><Undo2 aria-hidden="true" className="size-3" />Undone</Pill>}
        </div>
        {approved ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-by-body-sm text-by-text-2">
            {undone ? <Undo2 aria-hidden="true" className="size-[15px] shrink-0 text-by-muted" /> : <Check aria-hidden="true" className="size-[15px] shrink-0 text-by-success" />}
            <span className="min-w-0 flex-1">
              {undone
                ? <>Undone at your request. {proposal.undo_receipt ? <>{owner.name}: “{proposal.undo_receipt}”</> : `${owner.name} put it back as it was.`}</>
                : <>Approved by you. {proposal.receipt ? <>{owner.name}: “{proposal.receipt}”</> : `${owner.name} takes it from here in its own chat.`}</>}
            </span>
            {canUndo && (
              <Button size="sm" loading={busy === "undo"} disabled={busy != null} onClick={() => decide("undo")} aria-label={`Undo: ${title}`}><Undo2 aria-hidden="true" />Undo</Button>
            )}
            <Link href={ownerChatHref(proposal.agent, proposal.session_id, proposal.client_group_id)} className="inline-flex items-center gap-1 font-semibold text-by-accent hover:underline">
              Open {owner.name}’s chat<ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        ) : (
          <p className="text-by-body-sm text-by-muted">{expired ? "It lapsed before you decided, so nothing was changed." : "Nothing was changed."}</p>
        )}
        {failure?.what === "undo" && <Notice tone="danger">{undoErrorMessage(failure.err)}</Notice>}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2.5 px-3.5 py-3" role="group" aria-label={`Proposal: ${title}`}>
      <div className="flex items-center gap-2 text-by-body-sm">
        <AgentAvatar info={by} />
        <b className="font-semibold">{by.name} proposes</b>
        <Pill tone="warning" dot={false} className="ml-auto"><Clock aria-hidden="true" className="size-3" />Waiting for you</Pill>
      </div>
      <h4 className="text-by-body-lg font-semibold text-by-text">{title}</h4>
      {proposal.detail && <p className="rounded-by-md bg-by-canvas px-3 py-2 text-by-body-sm text-by-text-2 whitespace-pre-line">{proposal.detail}</p>}
      {failure && <Notice tone="danger">{proposalErrorMessage(failure.err)}</Notice>}
      <div className="flex flex-wrap items-center gap-2">
        <Button kind="primary" size="sm" loading={busy === "approve"} disabled={busy != null} onClick={() => decide("approve")}><Check aria-hidden="true" />Approve</Button>
        <Button size="sm" loading={busy === "dismiss"} disabled={busy != null} onClick={() => decide("dismiss")}>Decline</Button>
        <span className="ml-auto text-by-caption text-by-muted">{busy === "approve" ? `${owner.name} is making the change…` : `${owner.name} makes the change`}</span>
      </div>
    </Card>
  );
}

/**
 * The proposals a reply carries, under it: a sub-agent proposal walks through its set-up (B3),
 * anything else is an approval card (A1).
 */
export function ReplyProposals({ proposals, onUpdate, compact = false }) {
  if (!proposals?.length) return null;
  return (
    <div className="mt-2.5 flex flex-col gap-2.5">
      {proposals.map((p) => p.kind === SUB_AGENT_KIND
        ? <SubAgentProposal key={p.id} proposal={p} compact={compact} onUpdate={(patch) => onUpdate?.(p.id, patch)} />
        : <ProposalCard key={p.id} proposal={p} onUpdate={(patch) => onUpdate?.(p.id, patch)} />)}
    </div>
  );
}
