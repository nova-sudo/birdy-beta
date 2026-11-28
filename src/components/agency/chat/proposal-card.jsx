"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Check, Clock, Hash, Undo2, X } from "lucide-react";
import { AgentAvatar, Button, Card, Notice, Pill, cn } from "@/components/by";
import { AGENTS, agentInfo } from "@/lib/agent-route";
import { PROPOSAL_STATUSES, SUB_AGENT_KIND, applyProposal, dismissProposal, proposalErrorMessage, receiptLine, undoErrorMessage, undoProposal } from "@/lib/proposals-api";
import { rememberSectionChat } from "@/lib/section-chats";
import { Preview, reportPreview } from "@/components/agency/report-preview";
import { SECTION_CONFIG } from "@/components/agency/sections";
import { SubAgentProposal } from "./sub-agent-proposal";

const SECTION_OF = { birdy: "ops", media_buyer: "buyer", sales_coach: "coach" };

export const SLACK_REPORT_KIND = "slack_report";

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

/** Where a report lives: its owner's Reports page, or the report itself once it has an id. */
export function reportPageHref(owner, id) {
  const base = SECTION_CONFIG[SECTION_OF[owner] ?? "ops"]?.paths.reports ?? SECTION_CONFIG.ops.paths.reports;
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

/** "#sales-team", or Birdy's own channel when the report has none of its own. */
function channelOf(sendsTo, payload) {
  // What the server resolved wins; the report's own channel only when it sent nothing.
  const name = String((sendsTo ? sendsTo.channel_name : payload?.channel_name) ?? "").replace(/^#/, "").trim();
  return name ? { pill: `# ${name}`, line: `#${name}` } : { pill: "Default Birdy channel", line: "the default Birdy channel" };
}

/** "Every day · 09:00" reads on after "Sends": "Sends every day · 09:00". Day names keep their capital. */
const afterSends = (label) => String(label ?? "").replace(/^(Every|Each|When|Once|On|At)\b/, (w) => w.toLowerCase());

/** A refusal from creating the report: the server's own reason when it gave one about the report. */
function reportErrorMessage(err) {
  if (err?.detail && ![402, 404, 412].includes(err?.status)) return err.detail;
  return proposalErrorMessage(err);
}

/**
 * A report an agent wants to create from chat (1A): what it is, when and where it sends, and the
 * Slack message itself with today's numbers. Approve sits under the preview and waits for it.
 * Approving creates the report straight away; there is no agent run.
 *
 * @param {object} props.proposal a proposal of kind "slack_report":
 *   {id, agent, proposed_by, title, status, schedule_label, sends_to: {channel_id, channel_name, default_channel},
 *    payload: {name, owner, trigger, channel_id, channel_name, enabled, template}, report?: {id, owner, name}}
 * @param {(patch: object) => void} [props.onUpdate] keeps the decision on the reply
 */
export function ReportProposalCard({ proposal, onUpdate }) {
  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState(null);
  const [preview, setPreview] = useState("loading");
  const [changing, setChanging] = useState(false);
  const payload = proposal.payload ?? {};
  const ownerKey = AGENTS[proposal.agent] ? proposal.agent : AGENTS[payload.owner] ? payload.owner : "birdy";
  const owner = agentInfo(ownerKey);
  const by = AGENTS[proposal.proposed_by] ? agentInfo(proposal.proposed_by) : owner;
  const title = proposal.title || payload.name || "A new report";
  const channel = channelOf(proposal.sends_to, payload);
  const schedule = proposal.schedule_label || null;

  if (proposal.status !== "pending" && proposal.status !== "approved" && PROPOSAL_STATUSES.includes(proposal.status)) {
    return <ProposalCard proposal={proposal} onUpdate={onUpdate} />;
  }

  if (proposal.status === "approved") {
    return (
      <Card className="flex flex-col gap-2 px-3.5 py-3">
        <div className="flex items-center gap-2 text-by-body-sm">
          <AgentAvatar info={owner} />
          <b className="min-w-0 flex-1 font-semibold">{title}</b>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-by-body-sm text-by-text-2">
          <Check aria-hidden="true" className="size-[15px] shrink-0 text-by-success" />
          <span className="min-w-0 flex-1">Created. {schedule ? `Sends ${afterSends(schedule)} to ${channel.line}.` : `Sends to ${channel.line}.`}</span>
          <Link href={reportPageHref(ownerKey, proposal.report?.id)} className="inline-flex items-center gap-1 font-semibold text-by-accent hover:underline">
            Open in {owner.name} reports<ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      </Card>
    );
  }

  const decide = async (what) => {
    setBusy(what);
    setFailure(null);
    try {
      if (what === "approve") {
        const res = await applyProposal(proposal.id);
        onUpdate?.({ status: "approved", report: res?.report ?? null });
      } else {
        await dismissProposal(proposal.id);
        onUpdate?.({ status: "dismissed" });
      }
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(null);
    }
  };
  // A preview that failed doesn't block: the retry notice says so, and the owner can still decide.
  const ready = preview === "done" || preview === "error";

  return (
    <Card className="flex flex-col gap-2.5 px-3.5 py-3" role="group" aria-label={`Proposal: ${title}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-by-body-sm">
        <span className="flex min-w-0 flex-1 basis-52 items-center gap-2">
          <AgentAvatar info={by} />
          <b className="font-semibold">{by.name} wants to create a report</b>
        </span>
        <Pill tone="warning" dot={false} className="ml-auto"><Clock aria-hidden="true" className="size-3" />Waiting for you</Pill>
      </div>
      <h4 className="text-by-body-lg font-semibold text-by-text">{title}</h4>
      <div className="flex flex-wrap items-center gap-1.5">
        {schedule && <Pill dot={false}><CalendarClock aria-hidden="true" className="size-3" />{schedule}</Pill>}
        <Pill dot={false}>{channel.pill.startsWith("# ") ? <><Hash aria-hidden="true" className="size-3" />{channel.pill.slice(2)}</> : channel.pill}</Pill>
        <Pill dot={false}>{owner.name} reports</Pill>
      </div>
      <Preview
        auto
        load={() => reportPreview(payload.template, ownerKey)}
        onStatus={setPreview}
        note="Today’s real numbers. Your Slack shows it like this."
      />
      {failure && <Notice tone="danger">{reportErrorMessage(failure)}</Notice>}
      <div className="flex flex-wrap items-center gap-2 border-t border-by-line-soft pt-2.5">
        <Button kind="primary" size="sm" loading={busy === "approve"} disabled={busy != null || !ready} onClick={() => decide("approve")}>
          <Check aria-hidden="true" />Approve and create
        </Button>
        <Button size="sm" disabled={busy != null} aria-expanded={changing} onClick={() => setChanging((v) => !v)}>Change something</Button>
        <Button size="sm" loading={busy === "dismiss"} disabled={busy != null} onClick={() => decide("dismiss")}>Decline</Button>
        <span className="ml-auto text-by-caption text-by-muted">{busy === "approve" ? `${owner.name} is creating it…` : `${owner.name} makes it`}</span>
      </div>
      {changing && <p className="text-by-body-sm text-by-text-2">Tell {by.name} what to change below.</p>}
    </Card>
  );
}

/**
 * The proposals a reply carries, under it: a sub-agent proposal walks through its set-up (B3),
 * a new Slack report shows its preview (1A), anything else is an approval card (A1).
 */
export function ReplyProposals({ proposals, onUpdate, compact = false }) {
  if (!proposals?.length) return null;
  return (
    <div className="mt-2.5 flex flex-col gap-2.5">
      {proposals.map((p) => {
        const update = (patch) => onUpdate?.(p.id, patch);
        if (p.kind === SUB_AGENT_KIND) return <SubAgentProposal key={p.id} proposal={p} compact={compact} onUpdate={update} />;
        if (p.kind === SLACK_REPORT_KIND) return <ReportProposalCard key={p.id} proposal={p} onUpdate={update} />;
        return <ProposalCard key={p.id} proposal={p} onUpdate={update} />;
      })}
    </div>
  );
}
