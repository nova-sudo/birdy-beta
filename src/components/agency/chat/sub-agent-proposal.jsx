"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import { AgentAvatar, Button, Card, Notice, Stepper, cn } from "@/components/by";
import { ClientsChoice, JobFields, NameField, ScheduleChoice, ToolsChoice, useClientOptions } from "@/components/agency/sub-agent-fields";
import { agentInfo } from "@/lib/agent-route";
import {
  ALL_CLIENTS, PARENT_NAMES, clientsLine, draftErrors, draftOf, normalizeSubAgent, rejectSubAgent, saveAndApprove, scheduleLine, subAgentErrorMessage,
} from "@/lib/sub-agents";

const STEPS = ["Name", "Job", "Tools", "Clients", "Schedule", "Confirm"];
const QUESTIONS = ["What should it be called?", "What should it do?", "Which tools can it use?", "Which clients should it watch?", "When should it run?", "Ready to create it?"];
// Which of the draft's errors stop each step.
const STEP_FIELDS = [["name"], ["purpose"], ["tools"], ["clients"], ["schedule"], []];
const CONTEXT_PATH = { media_buyer: "/media-buyer/context", sales_coach: "/sales-coach/context" };

/**
 * A main agent proposing a sub-agent (option B3): one question at a time, with its own pick already
 * chosen. Name, what it does, tools (only the ones it offered), clients, schedule, then confirm.
 * Nothing is saved until "Create": the owner's changes go in one PATCH, then the approval.
 *
 * @param {object} props.proposal a chat proposal of kind "sub_agent": payload {sub_agent, approval}
 * @param {(patch: object) => void} [props.onUpdate] keeps the outcome on the reply
 * @param {boolean} [props.compact] the narrow column beside a page
 */
export function SubAgentProposal({ proposal, onUpdate, compact = false }) {
  const record = useMemo(() => normalizeSubAgent(proposal.payload?.sub_agent), [proposal.payload]);
  if (!record) return <Notice tone="warning">This sub-agent proposal came without its details, so it can’t be shown.</Notice>;
  const decided = ["approved", "dismissed", "expired"].includes(proposal.status) || record.status !== "proposed";
  return decided ? <Decided proposal={proposal} record={record} /> : <Walkthrough proposal={proposal} record={record} onUpdate={onUpdate} compact={compact} />;
}

function Face({ record }) {
  return <AgentAvatar info={agentInfo(`sub:${record.id}`, { name: record.name, parent: record.parent })} size={32} />;
}

function Decided({ proposal, record }) {
  const declined = proposal.status === "dismissed" || proposal.status === "expired";
  const parent = PARENT_NAMES[record.parent] ?? "its main agent";
  return (
    <Card className={cn("flex items-center gap-2.5 px-3.5 py-3 text-by-body-sm", declined && "opacity-[0.62]")}>
      <Face record={record} />
      <span className="min-w-0 flex-1">
        <b className="block font-semibold text-by-text">{record.name}</b>
        <span className="text-by-text-2">{proposal.status === "expired" ? "It lapsed before you decided. Nothing was saved." : declined ? "Declined. Nothing was saved." : `Set up under ${parent}. ${record.status === "paused" ? "It is paused." : "It is active."}`}</span>
      </span>
      {!declined && CONTEXT_PATH[record.parent] && (
        <Link href={`${CONTEXT_PATH[record.parent]}#sub-agents`} className="inline-flex shrink-0 items-center gap-1 font-semibold text-by-accent hover:underline">
          See it in Context<ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
      )}
    </Card>
  );
}

function Walkthrough({ proposal, record, onUpdate, compact }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => draftOf(record));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState(null);
  const { options, loading } = useClientOptions(record);
  const parentName = PARENT_NAMES[record.parent] ?? "Its main agent";
  const pick = draftOf(record);

  const questionRef = useRef(null);
  const moved = useRef(false);
  useEffect(() => {
    // Keyboard and screen reader users land on the new question; not on the first render.
    if (moved.current) questionRef.current?.focus();
    moved.current = true;
  }, [step]);

  const errors = draftErrors(draft);
  const blocking = STEP_FIELDS[step].filter((f) => errors[f]);
  const shown = tried ? errors : {};
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const go = (to) => { setTried(false); setStep(to); };
  const next = () => (blocking.length ? setTried(true) : go(step + 1));

  const create = async () => {
    if (Object.keys(errors).length) {
      setTried(true);
      return go(STEP_FIELDS.findIndex((fields) => fields.some((f) => errors[f])));
    }
    setBusy("create");
    setFailure(null);
    try {
      const saved = await saveAndApprove(record, draft);
      onUpdate?.({ status: "approved", payload: { ...proposal.payload, sub_agent: saved ?? { ...proposal.payload.sub_agent, status: "active" } } });
    } catch (err) {
      setFailure(err);
      if (err?.code === "duplicate_name") go(0);
    } finally {
      setBusy(null);
    }
  };
  const decline = async () => {
    setBusy("decline");
    setFailure(null);
    try {
      await rejectSubAgent(record.id);
      onUpdate?.({ status: "dismissed" });
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(null);
    }
  };

  const toolLabels = record.tools.filter((t) => draft.tools.includes(t.name)).map((t) => t.label).join(", ") || "None";
  const clientsChosen = draft.clients === ALL_CLIENTS ? ALL_CLIENTS : draft.clients.map((id) => ({ id, name: options.find((o) => o.id === id)?.name ?? null }));
  const summary = [
    ["Name", draft.name, 0],
    ["Job", draft.purpose, 1],
    ["Tools", toolLabels, 2],
    ["Clients", clientsLine(clientsChosen), 3],
    ["Runs", scheduleLine(draft.schedule), 4],
  ];

  return (
    <Card role="group" aria-label={`Setting up a sub-agent: ${draft.name || record.name}`} className="flex flex-col gap-3 px-3.5 py-3.5">
      <div className="flex items-center gap-2.5">
        <Face record={record} />
        <div className="min-w-0 flex-1">
          <span className="block text-by-caption text-by-muted">{parentName} proposes a sub-agent</span>
          <h4 className="truncate font-by-display text-by-body-lg font-semibold">{draft.name.trim() || record.name}</h4>
        </div>
        <Button kind="ghost" size="sm" loading={busy === "decline"} disabled={busy != null} onClick={decline}>Decline</Button>
      </div>

      {compact ? (
        <p className="text-by-caption font-semibold text-by-muted">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
      ) : (
        <Stepper steps={STEPS} current={step} aria-label="Set-up steps" />
      )}

      <h5 ref={questionRef} tabIndex={-1} className="font-semibold text-by-text outline-none">{QUESTIONS[step]}</h5>

      <div>
        {step === 0 && <NameField value={draft.name} onChange={(name) => set({ name })} error={shown.name ?? (failure?.code === "duplicate_name" ? "Another sub-agent already has that name." : undefined)} hint={draft.name === pick.name ? "My pick" : `My pick: ${pick.name}`} />}
        {step === 1 && <JobFields purpose={draft.purpose} instructions={draft.instructions} onChange={set} errors={shown} />}
        {step === 2 && (
          <>
            <p className="mb-2 text-by-body-sm text-by-text-2">These are the tools {parentName} picked for the job. Untick any it shouldn’t have; it can’t be given others here.</p>
            <ToolsChoice tools={record.tools} value={draft.tools} onChange={(tools) => set({ tools })} error={shown.tools} />
          </>
        )}
        {step === 3 && <ClientsChoice value={draft.clients} onChange={(clients) => set({ clients })} options={options} loading={loading} error={shown.clients} pick={pick.clients === ALL_CLIENTS ? "all" : "some"} />}
        {step === 4 && <ScheduleChoice value={draft.schedule} onChange={(schedule) => set({ schedule })} error={shown.schedule} pick={pick.schedule ? "scheduled" : "asked"} parentName={parentName} />}
        {step === 5 && (
          <dl className="flex flex-col gap-1 text-by-body-sm">
            {summary.map(([label, value, at]) => (
              <div key={label} className="flex items-baseline gap-2">
                <dt className="w-16 shrink-0 text-by-muted">{label}</dt>
                <dd className="min-w-0 flex-1 text-by-text">{value}</dd>
                <dd className="shrink-0">
                  <button type="button" className="cursor-pointer text-by-caption font-semibold text-by-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent" onClick={() => go(at)} aria-label={`Change ${label.toLowerCase()}`}>Change</button>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {failure && <Notice tone="danger">{subAgentErrorMessage(failure)}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        {step < STEPS.length - 1 ? (
          <Button kind="primary" size="sm" disabled={busy != null} onClick={next}>Next</Button>
        ) : (
          <Button kind="primary" loading={busy === "create"} disabled={busy != null} onClick={create}><Plus aria-hidden="true" />Create {draft.name.trim() || record.name}</Button>
        )}
        {step > 0 && <Button kind="ghost" size={step < STEPS.length - 1 ? "sm" : "md"} disabled={busy != null} onClick={() => go(step - 1)}>Back</Button>}
        <span className="ml-auto text-by-caption text-by-muted">{step < STEPS.length - 1 ? "Nothing is saved until the last step" : <><Check aria-hidden="true" className="mr-1 inline size-3 align-[-1px]" />Runs only after you create it</>}</span>
      </div>
    </Card>
  );
}
