"use client";

// A sub-agent's runs on Context: "Run now" (confirm, progress, result) and the
// list of its last runs. Both read the server's run records only.

import { Fragment, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Loader2, Play } from "lucide-react";
import {
  Button, Dialog, DialogBody, DialogContent, DialogFooter, Notice, Pill, Skeleton, Table, TableBody, TableHead, TableScroll, Td, Th, Tr, buttonVariants, cn,
} from "@/components/by";
import { ReplyProposals } from "@/components/agency/chat/proposal-card";
import { formatCredits, formatSeconds } from "@/lib/agent-route";
import { parseServerDate } from "@/lib/stock-agent-api";
import { RUN_WORDS, normalizeRun, runErrorMessage, runSeconds, runSubAgent, useSubAgentRuns } from "@/lib/sub-agents";

const TRIGGER_WORDS = { manual: "Run by you", schedule: "On its schedule" };
const SUGGESTIONS_PATH = { media_buyer: "/media-buyer/suggestions", sales_coach: "/sales-coach/suggestions" };

/** "20 Nov, 08:00". */
export const runWhen = (iso) => {
  const d = parseServerDate(iso);
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
};

const took = (run) => {
  const s = runSeconds(run, parseServerDate);
  return s == null ? null : formatSeconds(s);
};

/** A run's outcome as a pill. */
export function RunStatus({ status }) {
  const words = RUN_WORDS[status] ?? RUN_WORDS.error;
  return <Pill tone={words.tone}>{words.label}</Pill>;
}

/**
 * What one run found, and anything it proposes (each waits for the owner's approval).
 * @param {boolean} [props.head] its outcome, summary and cost on top; the runs table already shows them
 */
function RunResult({ run, sub, onProposal, head = true }) {
  const meta = [took(run) && `Took ${took(run)}`, run.credits > 0 && formatCredits(run.credits)].filter(Boolean).join(" · ");
  // Its proposals are its own: say so by name.
  const proposals = run.proposals.map((p) => (p.proposed_by === `sub:${sub.id}` && !p.proposed_by_name ? { ...p, proposed_by_name: sub.name } : p));
  return (
    <div className="flex flex-col gap-3">
      {head && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <RunStatus status={run.status} />
          {run.summary && <b className="min-w-0 flex-1 font-semibold text-by-text">{run.summary}</b>}
          {meta && <span className="ml-auto text-by-caption text-by-muted tabular-nums">{meta}</span>}
        </div>
      )}
      {run.answer ? (
        <div className="max-h-72 overflow-y-auto overscroll-contain rounded-by-md bg-by-sunken px-3 py-2.5 text-by-body-sm whitespace-pre-wrap text-by-text">{run.answer}</div>
      ) : (
        <p className="text-by-body-sm text-by-muted">{run.status === "skipped" ? "It had nothing to do this time." : "No answer came back."}</p>
      )}
      {run.proposals.length > 0 && (
        <div>
          <p className="text-by-body-sm font-semibold text-by-text">{run.proposals.length === 1 ? "It proposes 1 change" : `It proposes ${run.proposals.length} changes`}</p>
          <ReplyProposals proposals={proposals} onUpdate={onProposal} />
          {SUGGESTIONS_PATH[sub.parent] && (
            <Link href={SUGGESTIONS_PATH[sub.parent]} className="mt-2 inline-flex items-center gap-1 text-by-body-sm font-semibold text-by-accent hover:underline">
              These also wait in Suggestions<ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** Keeps an owner's decision on a run's proposals while the dialog is open. */
function useLocalProposals(setRun) {
  return (id, patch) => setRun((r) => (r ? { ...r, proposals: r.proposals.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : r));
}

/**
 * "Run now": asks first (it uses credits), then shows that it is working, then what came back.
 * @param {object|null} props.sub the sub-agent to run; null keeps the dialog closed
 * @param {() => void} props.onClose
 * @param {() => void} [props.onDone] the run finished or failed (refresh the list)
 */
export function RunNowDialog({ sub, onClose, onDone }) {
  const [state, setState] = useState("confirm"); // confirm | running | done | failed
  const [run, setRun] = useState(null);
  const [failure, setFailure] = useState(null);
  const onProposal = useLocalProposals(setRun);

  const start = async () => {
    setState("running");
    setFailure(null);
    try {
      const res = await runSubAgent(sub.id);
      setRun(normalizeRun(res?.run ?? res));
      setState("done");
    } catch (err) {
      setFailure(err);
      setState("failed");
    } finally {
      onDone?.();
    }
  };

  const close = () => {
    setState("confirm");
    setRun(null);
    setFailure(null);
    onClose();
  };

  return (
    <Dialog open={sub != null} onOpenChange={(open) => !open && close()}>
      {sub && (
        <DialogContent title={state === "confirm" ? `Run ${sub.name} now?` : `${sub.name}’s run`}>
          <DialogBody className="flex flex-col gap-3">
            {state === "confirm" && (
              <>
                <p className="text-by-body text-by-text-2 text-pretty">{sub.name} does its job once now, the same way it does when it runs on its own. This uses Birdy Credits, like any answer.</p>
                <p className="text-by-body text-by-text-2 text-pretty">Nothing on a live account changes. Anything it wants to change waits for your approval.</p>
              </>
            )}
            {state === "running" && (
              <div role="status" className="flex items-center gap-3 rounded-by-md bg-by-canvas px-3.5 py-3">
                <Loader2 aria-hidden="true" className="size-5 shrink-0 animate-spin text-by-accent motion-reduce:animate-none" />
                <span className="min-w-0 flex-1">
                  <b className="block font-semibold text-by-text">{sub.name} is working</b>
                  <span className="text-by-body-sm text-by-text-2">This can take a minute or two. You can close this; the result shows on its row when it’s done.</span>
                </span>
              </div>
            )}
            {state === "failed" && <Notice tone="danger">{runErrorMessage(failure)}</Notice>}
            {state === "done" && run && <RunResult run={run} sub={sub} onProposal={onProposal} />}
          </DialogBody>
          <DialogFooter className="justify-end">
            {state === "confirm" ? (
              <>
                <Button kind="ghost" onClick={close}>Cancel</Button>
                <Button kind="primary" onClick={start}><Play aria-hidden="true" />Run now</Button>
              </>
            ) : (
              <Button kind={state === "running" ? "ghost" : "primary"} onClick={close}>{state === "running" ? "Close" : "Done"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

/**
 * A sub-agent's last runs, newest first, in a table that scrolls inside its card. A row opens to
 * show the run's answer and what it proposed.
 * @param {object|null} props.sub null keeps the dialog closed
 */
export function RunsDialog({ sub, onClose }) {
  return (
    <Dialog open={sub != null} onOpenChange={(open) => !open && onClose()}>
      {sub && (
        <DialogContent size="xl" title={`${sub.name}’s runs`} description="The last 20, newest first.">
          <RunsBody sub={sub} />
          <DialogFooter className="justify-end">
            <Button kind="primary" onClick={onClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

function RunsBody({ sub }) {
  const { runs, unavailable, error, isLoading, mutate } = useSubAgentRuns(sub.id);
  const [open, setOpen] = useState(null);
  const [decided, setDecided] = useState({});
  const withDecisions = (run) => ({ ...run, proposals: run.proposals.map((p) => ({ ...p, ...decided[p.id] })) });

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 py-4.5">
      {unavailable ? (
        <p className="text-by-body text-by-text-2">Run history is not available yet. It will show here once it is switched on for your account.</p>
      ) : error ? (
        <Notice tone="danger" action={<Button size="sm" onClick={() => mutate()}>Retry</Button>}>Couldn’t load {sub.name}’s runs. Check your connection and try again.</Notice>
      ) : isLoading ? (
        <div aria-busy="true" aria-label="Loading runs" className="flex flex-col gap-3"><Skeleton className="w-64" /><Skeleton className="w-96 max-w-full" /><Skeleton className="w-80 max-w-full" /></div>
      ) : runs.length === 0 ? (
        <p className="text-by-body text-by-text-2">{sub.name} hasn’t run yet. Its runs show here once it has, whether on its schedule, when {sub.parent === "sales_coach" ? "Sales Coach" : "Marketing Guru"} asks it, or when you run it by hand.</p>
      ) : (
        <TableScroll className="max-h-[min(60vh,32rem)] shadow-none">
          <Table aria-label={`${sub.name}’s runs`}>
            <TableHead>
              <tr>
                <Th>Started</Th>
                <Th>Outcome</Th>
                <Th className="w-full">What it found</Th>
                <Th numeric>Took</Th>
                <Th numeric>Credits</Th>
                <Th><span className="sr-only">Details</span></Th>
              </tr>
            </TableHead>
            <TableBody>
              {runs.map((raw, i) => {
                const run = withDecisions(raw);
                const key = run.id ?? `run-${i}`;
                const expanded = open === key;
                return (
                  <Fragment key={key}>
                    <Tr interactive onClick={() => setOpen(expanded ? null : key)} className={cn(expanded && "bg-by-canvas")}>
                      <Td className="tabular-nums">
                        {runWhen(run.started_at) ?? "Unknown"}
                        {TRIGGER_WORDS[run.trigger] && <span className="block text-by-caption text-by-muted">{TRIGGER_WORDS[run.trigger]}</span>}
                      </Td>
                      <Td><RunStatus status={run.status} /></Td>
                      <Td className="max-w-0 truncate whitespace-nowrap" title={run.summary || undefined}>
                        {run.summary || <span className="text-by-muted">No summary</span>}
                        {run.proposals.length > 0 && <span className="ml-2 text-by-caption text-by-accent">{run.proposals.length === 1 ? "1 proposal" : `${run.proposals.length} proposals`}</span>}
                      </Td>
                      <Td numeric>{took(run) ?? "–"}</Td>
                      <Td numeric>{run.credits > 0 ? run.credits.toLocaleString("en-GB") : "–"}</Td>
                      <Td className="w-10 pr-3">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Hide" : "Show"} the run of ${runWhen(run.started_at) ?? "an unknown time"}`}
                          onClick={(e) => { e.stopPropagation(); setOpen(expanded ? null : key); }}
                          className={cn(buttonVariants({ kind: "ghost", size: "sm", iconOnly: true }))}
                        >
                          <ChevronDown aria-hidden="true" className={cn("transition-transform duration-(--by-dur-fast) ease-by-out motion-reduce:transition-none", expanded && "rotate-180")} />
                        </button>
                      </Td>
                    </Tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="border-b border-by-line-soft bg-by-canvas px-4 pt-3 pb-4">
                          <RunResult run={run} sub={sub} head={false} onProposal={(id, patch) => setDecided((d) => ({ ...d, [id]: { ...d[id], ...patch } }))} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableScroll>
      )}
    </div>
  );
}
