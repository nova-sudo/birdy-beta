"use client";

import { useState } from "react";
import { BarChart3, CalendarClock, Check, Pencil, UserRound, Users } from "lucide-react";
import { AgentAvatar, Button, Card, Dialog, DialogBody, DialogContent, DialogFooter, Notice, cn } from "@/components/by";
import { ClientsChoice, JobFields, NameField, ScheduleChoice, useClientOptions } from "@/components/agency/sub-agent-fields";
import { agentInfo } from "@/lib/agent-route";
import { cardFacts } from "@/lib/sub-agent-card";
import { PARENT_NAMES, changeSubAgent, draftErrors, draftOf, patchOf, subAgentErrorMessage } from "@/lib/sub-agents";

const FACT_ICON = { clients: Users, runs: CalendarClock, reads: BarChart3, reports: UserRound };

// Tools aren't changed here, so a missing tool never blocks saving the rest.
const fieldErrors = (draft) => {
  const { tools: _tools, ...rest } = draftErrors(draft);
  return rest;
};

/** A sub-agent's own tile: the robot with its main agent's badge. */
export function SubAgentTile({ record, className }) {
  return <AgentAvatar info={agentInfo(`sub:${record.id}`, { name: record.name, parent: record.parent })} size={32} className={cn("size-11 rounded-by-lg [&>svg]:size-5", className)} />;
}

/**
 * One proposed sub-agent as a single card: its tile, name, job in one line,
 * four facts (clients, when it runs, what it reads, who it reports to), and
 * the choice. "Add it" approves it with the agent's picks; "Change details"
 * opens the fields for the few who want to adjust first.
 *
 * @param {object} props.record a normalized sub-agent waiting for approval
 * @param {{n: number, of: number}} [props.position] where it is among the ones waiting, said when there are several
 * @param {"add"|"skip"|null} props.busy which choice is being saved
 * @param {Error|null} [props.failure]
 * @param {() => void} props.onAdd
 * @param {() => void} props.onSkip
 * @param {(saved: object) => void} props.onChanged the details were saved
 */
export function SubAgentIdea({ record, position, busy, failure, onAdd, onSkip, onChanged }) {
  const [editing, setEditing] = useState(false);
  const facts = cardFacts(record);
  return (
    <Card role="group" aria-label={`Sub-agent idea: ${record.name}`} className="flex w-full max-w-xl flex-col gap-4 p-4 motion-safe:animate-[by-enter_var(--by-dur-base)_var(--by-ease-out)]">
      <div className="flex items-start gap-3">
        <SubAgentTile record={record} />
        <div className="min-w-0 flex-1">
          <h3 className="font-by-display text-by-body-lg font-semibold text-by-text">{record.name}</h3>
          {record.purpose && <p className="mt-0.5 text-by-body text-by-text-2 text-pretty">{record.purpose}</p>}
        </div>
        {position && position.of > 1 && (
          <span className="shrink-0 rounded-full bg-by-sunken px-2.5 py-0.5 text-by-caption font-semibold tabular-nums text-by-text-2">{position.n} of {position.of}</span>
        )}
      </div>

      <dl className="grid gap-2 sm:grid-cols-2">
        {facts.map((f) => {
          const Icon = FACT_ICON[f.key];
          return (
            <div key={f.key} className="flex items-start gap-2.5 rounded-by-md bg-by-canvas px-3 py-2.5">
              <span aria-hidden="true" className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-by-sm bg-by-surface text-by-text-2 shadow-by-card [&>svg]:size-3.5"><Icon /></span>
              <div className="min-w-0">
                <dt className="text-by-caption text-by-muted">{f.label}</dt>
                <dd className="text-by-body-sm font-medium text-by-text">{f.value}</dd>
              </div>
            </div>
          );
        })}
      </dl>

      {failure && <Notice tone="danger">{subAgentErrorMessage(failure)}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        <Button kind="primary" loading={busy === "add"} disabled={busy != null} onClick={onAdd}><Check aria-hidden="true" />Add it</Button>
        <Button loading={busy === "skip"} disabled={busy != null} onClick={onSkip}>Not now</Button>
        <Button kind="ghost" size="sm" className="ml-auto" disabled={busy != null} onClick={() => setEditing(true)}><Pencil aria-hidden="true" />Change details</Button>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        {editing && <ChangeDetails record={record} onClose={() => setEditing(false)} onSaved={onChanged} />}
      </Dialog>
    </Card>
  );
}

/** Name, job, clients and schedule, saved in one PATCH of what changed. It stays waiting for "Add it". */
function ChangeDetails({ record, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => draftOf(record));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState(null);
  const { options, loading } = useClientOptions(record);
  const parentName = PARENT_NAMES[record.parent] ?? "Its main agent";
  const errors = tried ? fieldErrors(draft) : {};
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    setTried(true);
    if (Object.keys(fieldErrors(draft)).length) return;
    const body = patchOf(record, draft);
    if (!Object.keys(body).length) return onClose();
    setSaving(true);
    setFailure(null);
    try {
      const saved = await changeSubAgent(record.id, body);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setFailure(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent title={`Change ${record.name}`} description="Nothing runs until you add it.">
      <form onSubmit={save} className="flex min-h-0 flex-1 flex-col" noValidate>
        <DialogBody className="flex flex-col gap-5">
          {failure && <Notice tone="danger">{subAgentErrorMessage(failure)}</Notice>}
          <NameField value={draft.name} onChange={(name) => set({ name })} error={errors.name ?? (failure?.code === "duplicate_name" ? "That name is taken." : undefined)} />
          <JobFields purpose={draft.purpose} instructions={draft.instructions} onChange={set} errors={errors} />
          <section aria-labelledby="sa-idea-clients">
            <h3 id="sa-idea-clients" className="mb-1.5 text-by-body-sm font-medium">Clients</h3>
            <ClientsChoice value={draft.clients} onChange={(clients) => set({ clients })} options={options} loading={loading} error={errors.clients} />
          </section>
          <section aria-labelledby="sa-idea-schedule">
            <h3 id="sa-idea-schedule" className="mb-1.5 text-by-body-sm font-medium">When it runs</h3>
            <ScheduleChoice value={draft.schedule} onChange={(schedule) => set({ schedule })} error={errors.schedule} parentName={parentName} />
          </section>
        </DialogBody>
        <DialogFooter className="justify-end">
          <Button kind="ghost" onClick={onClose}>Cancel</Button>
          <Button kind="primary" type="submit" loading={saving}>Save changes</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
