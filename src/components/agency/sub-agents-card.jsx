"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Bot, CalendarClock, Check, MessageSquare, Pause, Pencil, Play, Trash2, Users, Wrench } from "lucide-react";
import { AgentAvatar, Button, Card, Dialog, DialogBody, DialogContent, DialogFooter, Notice, Pill, Skeleton, buttonVariants, cn } from "@/components/by";
import { ContextCardHead } from "@/components/agency/context-parts";
import { SubAgentEditDialog } from "@/components/agency/sub-agent-fields";
import { sectionTabHref } from "@/components/agency/tabs";
import { agentInfo } from "@/lib/agent-route";
import { customAgentPath } from "@/lib/agents-api";
import { parseServerDate } from "@/lib/stock-agent-api";
import {
  ALL_CLIENTS, PARENT_NAMES, approveSubAgent, clientsLine, deleteSubAgent, pauseSubAgent, rejectSubAgent, resumeSubAgent, scheduleLine,
  subAgentErrorMessage, toolsLine, useSubAgents,
} from "@/lib/sub-agents";

const STATUS = {
  proposed: { tone: "warning", label: "Waiting for you" },
  active: { tone: "success", label: "Active" },
  paused: { tone: "neutral", label: "Paused" },
};

const when = (iso) => {
  const d = parseServerDate(iso);
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
};

function Meta({ icon: Icon, label, children }) {
  return (
    <span className="flex min-w-0 items-start gap-1.5">
      <Icon aria-hidden="true" className="mt-[3px] size-3 shrink-0 text-by-muted" />
      <span className="min-w-0"><span className="sr-only">{label}: </span>{children}</span>
    </span>
  );
}

/** One sub-agent: who it is, what it does, its tools, clients and schedule, and what can be done to it. */
function SubAgentRow({ sub, busy, onAct, onEdit, onDelete }) {
  const info = agentInfo(`sub:${sub.id}`, { name: sub.name, parent: sub.parent });
  const status = STATUS[sub.status];
  const custom = sub.kind === "custom";
  const lastRun = when(sub.last_run_at);
  const doing = busy?.id === sub.id ? busy.what : null;
  const locked = busy != null;
  return (
    <li className={cn("flex flex-wrap items-start gap-x-3 gap-y-2.5 border-t border-by-line-soft py-3.5 first:border-t-0 first:pt-1", sub.status === "paused" && "[&_[data-face]]:opacity-60 [&_[data-face]]:grayscale")}>
      <span data-face className="pt-0.5"><AgentAvatar info={info} size={32} /></span>
      <div className="min-w-0 flex-1 basis-72">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <b className="font-semibold text-by-text">{sub.name}</b>
          <Pill tone={status.tone}>{status.label}</Pill>
          {custom && <Pill tone="neutral" dot={false}>Rules agent</Pill>}
        </div>
        {sub.purpose && <p className="mt-0.5 text-by-body text-by-text-2 text-pretty">{sub.purpose}</p>}
        <div className="mt-1.5 flex flex-col gap-0.5 text-by-caption text-by-muted">
          {!custom && <Meta icon={Wrench} label="Tools">{toolsLine(sub.tools)}</Meta>}
          <Meta icon={Users} label="Clients">{clientsLine(sub.clients)}</Meta>
          {!custom && <Meta icon={CalendarClock} label="Runs">{scheduleLine(sub.schedule)}{sub.status !== "proposed" && ` · ${lastRun ? `last ran ${lastRun}` : "not run yet"}`}</Meta>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {custom ? (
          <Link href={customAgentPath(sub.id)} className={buttonVariants({ kind: "ghost", size: "sm" })}>Manage on its page<ArrowUpRight aria-hidden="true" /></Link>
        ) : sub.status === "proposed" ? (
          <>
            <Button kind="primary" size="sm" loading={doing === "approve"} disabled={locked} onClick={() => onAct(sub, "approve")} aria-label={`Approve ${sub.name}`}><Check aria-hidden="true" />Approve</Button>
            <Button size="sm" loading={doing === "reject"} disabled={locked} onClick={() => onAct(sub, "reject")} aria-label={`Decline ${sub.name}`}>Decline</Button>
            <Button kind="ghost" size="sm" disabled={locked} onClick={() => onEdit(sub)} aria-label={`Edit ${sub.name}`}><Pencil aria-hidden="true" />Edit</Button>
          </>
        ) : (
          <>
            <Button kind="ghost" size="sm" disabled={locked} onClick={() => onEdit(sub)} aria-label={`Edit ${sub.name}`}><Pencil aria-hidden="true" />Edit</Button>
            {sub.status === "active" ? (
              <Button kind="ghost" size="sm" loading={doing === "pause"} disabled={locked} onClick={() => onAct(sub, "pause")} aria-label={`Pause ${sub.name}`}><Pause aria-hidden="true" />Pause</Button>
            ) : (
              <Button kind="ghost" size="sm" loading={doing === "resume"} disabled={locked} onClick={() => onAct(sub, "resume")} aria-label={`Resume ${sub.name}`}><Play aria-hidden="true" />Resume</Button>
            )}
            <Button kind="ghost" size="sm" className="text-by-danger hover:bg-by-danger-bg hover:text-by-danger" disabled={locked} onClick={() => onDelete(sub)} aria-label={`Delete ${sub.name}`}><Trash2 aria-hidden="true" />Delete</Button>
          </>
        )}
      </div>
    </li>
  );
}

const ACTIONS = { approve: approveSubAgent, reject: rejectSubAgent, pause: pauseSubAgent, resume: resumeSubAgent, delete: deleteSubAgent };

/**
 * A main agent's sub-agents on its Context page: proposals waiting for approval first, then the
 * ones at work, then paused ones. Inside a client only the ones that cover it are listed.
 *
 * @param {import("./sections").SectionConfig} props.section Media Buyer or Sales Coach
 * @param {string|null} [props.clientId]
 * @param {(n: number) => void} [props.onWaiting] how many proposals wait for the owner
 */
export function SubAgentsCard({ section, clientId = null, onWaiting }) {
  const parent = section.subAgents;
  const parentName = PARENT_NAMES[parent] ?? section.kit.name;
  const search = useSearchParams();
  const { subAgents, unavailable, error, isLoading, mutate } = useSubAgents(parent);
  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const shown = clientId ? subAgents.filter((s) => s.clients === ALL_CLIENTS || s.clients.some((c) => c.id === clientId)) : subAgents;
  const waiting = shown.filter((s) => s.status === "proposed").length;
  useEffect(() => onWaiting?.(waiting), [waiting, onWaiting]);

  const act = async (sub, what) => {
    setBusy({ id: sub.id, what });
    setFailure(null);
    try {
      await ACTIONS[what](sub.id);
      if (what === "delete") setDeleting(null);
    } catch (err) {
      setFailure({ name: sub.name, err });
      if (what === "delete") setDeleting(null);
    } finally {
      setBusy(null);
      mutate();
    }
  };

  const chatHref = sectionTabHref(section, "chat", search);
  const count = shown.length;

  return (
    <Card id="sub-agents" role="region" aria-labelledby="cx-subs" className="scroll-mt-6 px-5 pt-[18px] pb-4">
      <ContextCardHead
        icon={Bot}
        title="Sub-agents"
        id="cx-subs"
        action={count > 0 && <span className="text-by-caption text-by-muted tabular-nums">{count === 1 ? "1 sub-agent" : `${count} sub-agents`}</span>}
      />
      {failure && <Notice className="mb-3" tone="danger">{failure.name}: {subAgentErrorMessage(failure.err)}</Notice>}
      {unavailable ? (
        <p className="py-1 text-by-body text-by-text-2">Sub-agents are not available yet. They will show here once they are switched on for your account.</p>
      ) : error ? (
        <Notice tone="danger" action={<Button size="sm" onClick={() => mutate()}>Retry</Button>}>Couldn’t load {parentName}’s sub-agents. Check your connection and try again.</Notice>
      ) : isLoading ? (
        <div aria-busy="true" aria-label="Loading sub-agents" className="flex flex-col gap-3 py-1"><Skeleton className="w-48" /><Skeleton className="w-80 max-w-full" /></div>
      ) : count === 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-1">
          <p className="min-w-0 flex-1 basis-80 text-by-body text-by-text-2 text-pretty">
            {clientId ? `None of ${parentName}’s sub-agents cover this client. ` : `${parentName} has no sub-agents yet. `}
            Sub-agents are created by asking {parentName} in Chat: it proposes one for a job you want done again and again, and nothing runs until you approve it.
          </p>
          <Link href={chatHref} className={buttonVariants({ kind: "secondary", size: "sm" })}><MessageSquare aria-hidden="true" />Ask {parentName}</Link>
        </div>
      ) : (
        <ul aria-label={`${parentName}’s sub-agents`} className="flex flex-col">
          {shown.map((sub) => (
            <SubAgentRow key={sub.id} sub={sub} busy={busy} onAct={act} onEdit={setEditing} onDelete={setDeleting} />
          ))}
        </ul>
      )}
      {count > 0 && !unavailable && !error && <p className="mt-auto flex items-center gap-[7px] pt-3 text-by-caption text-by-muted">
        <Bot aria-hidden="true" className="size-[13px] shrink-0 text-by-accent-line" />
        {parentName} asks these during a chat, and each runs on its own schedule. They work only in {parentName}’s area.
      </p>}

      <SubAgentEditDialog record={editing} open={editing != null} onOpenChange={(open) => !open && setEditing(null)} onSaved={() => mutate()} />

      <Dialog open={deleting != null} onOpenChange={(open) => !open && busy == null && setDeleting(null)}>
        {deleting && (
          <DialogContent title={`Delete ${deleting.name}?`}>
            <DialogBody>
              <p className="text-by-body text-by-text-2">This removes {deleting.name} with its lessons and its schedule. It can’t be undone.</p>
              {deleting.status === "active" && <p className="mt-2 text-by-body text-by-text-2">Pausing keeps everything, and you can resume it later.</p>}
            </DialogBody>
            <DialogFooter className="justify-end">
              <Button kind="ghost" disabled={busy != null} onClick={() => setDeleting(null)}>Cancel</Button>
              {deleting.status === "active" && (
                <Button disabled={busy != null} loading={busy?.what === "pause"} onClick={async () => { await act(deleting, "pause"); setDeleting(null); }}><Pause aria-hidden="true" />Pause instead</Button>
              )}
              <Button kind="danger" loading={busy?.what === "delete"} disabled={busy != null} onClick={() => act(deleting, "delete")}><Trash2 aria-hidden="true" />Delete</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
}
