"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import getSymbolFromCurrency from "currency-symbol-map";
import { Hash } from "lucide-react";
import { Button, NativeSelectField, Notice, Skeleton, cn } from "@/components/by";
import { apiRequest } from "@/lib/api";
import { fetcher } from "@/lib/fetcher";
import { playbookRules, ruleSentence } from "@/lib/rule-copy";
import { OUTCOME_OPTIONS_KEY, practiceStatus, startPractice } from "@/lib/team-setup";
import { outcomeChoices, outcomeId, outcomesBody, playbookLines, practiceLines } from "@/lib/team-setup-forms";
import { FormShell, saveError, useSave } from "./form-shell";

export const PRACTICE_POLL_MS = 2000;
const CHIP = "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-by-md border px-3 font-by-body text-by-body-sm font-medium transition-colors duration-(--by-dur-fast) ease-by-out disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent [&>svg]:size-3.5";
const chipTone = (on) => (on ? "border-by-accent bg-by-accent-soft text-by-accent" : "border-by-line-strong bg-by-surface text-by-text hover:bg-by-canvas");

/**
 * The rules the agent drafted, to confirm. The reply's block carries them
 * (`playbook`); changing one happens in the chat, where the agent has the tools.
 */
export function PlaybookForm({ data, ctx, onSubmit, saveLabel = "Yes, that’s it" }) {
  const rules = playbookRules(data?.playbook);
  const lines = playbookLines(data);
  const { busy, error, run } = useSave(onSubmit);
  const sym = getSymbolFromCurrency(ctx.currency || "GBP") || "£";
  return (
    <FormShell
      label="Playbook"
      error={error}
      busy={busy}
      actions={
        <>
          <Button kind="primary" loading={busy} onClick={() => run({ confirmed: true })}>{saveLabel}</Button>
          {ctx.onSend && <Button disabled={busy} onClick={() => ctx.onSend("I have a question about the playbook")}>Ask about it</Button>}
        </>
      }
    >
      {lines.length ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-by-body-sm">
          {lines.map((l) => (
            <div key={l.label} className="contents">
              <dt className="text-by-muted">{l.label}</dt>
              <dd className="text-by-text">{l.value}</dd>
            </div>
          ))}
        </dl>
      ) : rules.length ? (
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-by-body text-by-text marker:text-by-muted">
          {rules.map((r, i) => <li key={`${r.kind}-${i}`}>{ruleSentence(r, sym)}</li>)}
        </ol>
      ) : (
        <p className="text-by-body-sm text-by-muted">The playbook isn’t listed here. Ask in the chat to see it before you confirm.</p>
      )}
    </FormShell>
  );
}

/** Where it posts: a Slack channel, or nowhere. Uses the same channel list as Settings. */
export function SlackForm({ initial, data, onSubmit }) {
  // The reply says whether Slack is connected; when it isn't, there is no list to ask for.
  const offline = data?.connected === false;
  const [channels, setChannels] = useState(null);
  const [failed, setFailed] = useState(false);
  const [other, setOther] = useState("");
  const [picked, setPicked] = useState(initial?.channel_id ?? null);
  const { busy, error, run } = useSave(onSubmit);

  useEffect(() => {
    if (offline) return undefined;
    let live = true;
    (async () => {
      try {
        const res = await apiRequest("/api/integrations/slack/channels");
        if (!res.ok) throw new Error("list failed");
        const body = await res.json();
        if (live) setChannels(Array.isArray(body?.channels) ? body.channels.filter((c) => c && c.id) : []);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => { live = false; };
  }, [offline]);

  const save = (channel_id) => {
    setPicked(channel_id);
    run({ channel_id });
  };
  // The chosen channel first, then the rest; a handful as chips, the others in a list.
  const ordered = useMemo(() => {
    const list = channels ?? [];
    const first = list.find((c) => c.id === initial?.channel_id);
    return first ? [first, ...list.filter((c) => c !== first)] : list;
  }, [channels, initial?.channel_id]);
  const chips = ordered.slice(0, 4);
  const rest = ordered.slice(4);

  return (
    <FormShell
      label="Slack"
      error={error}
      busy={busy}
      actions={<Button kind="ghost" loading={busy && picked === null} disabled={busy} onClick={() => save(null)}>Not in Slack</Button>}
    >
      {offline ? (
        <Notice tone="warning">Slack isn’t connected. Connect it in Settings, or carry on without it.</Notice>
      ) : failed ? (
        <Notice tone="warning">I couldn’t list your Slack channels. Connect Slack in Settings, or carry on without it.</Notice>
      ) : channels === null ? (
        <div aria-busy="true" aria-label="Loading channels" className="flex gap-2"><Skeleton className="h-8 w-28" /><Skeleton className="h-8 w-24" /></div>
      ) : channels.length === 0 ? (
        <p className="text-by-body-sm text-by-muted">Slack has no channels I can post to yet.</p>
      ) : (
        <>
          <div role="group" aria-label="Channels" className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button key={c.id} type="button" disabled={busy} aria-pressed={picked === c.id} onClick={() => save(c.id)} className={cn(CHIP, chipTone(picked === c.id))}>
                <Hash aria-hidden="true" />{c.name || c.id}
              </button>
            ))}
          </div>
          {rest.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <NativeSelectField
                label="Another channel"
                options={[{ value: "", label: "Pick a channel" }, ...rest.map((c) => ({ value: c.id, label: `#${c.name || c.id}` }))]}
                value={other}
                onChange={(e) => setOther(e.target.value)}
                className="min-w-0 flex-1 basis-52"
              />
              <Button kind="primary" disabled={!other || busy} loading={busy && picked === other} onClick={() => save(other)}>Use it</Button>
            </div>
          )}
        </>
      )}
    </FormShell>
  );
}

/**
 * The practice run: a real run on the agent's clients that changes nothing in
 * Meta and sends nothing to Slack. Not a setup step: it shows only when the owner
 * asked for one, and nothing is saved from it. Start it, wait for it, read the summary.
 */
export function PracticeForm({ data }) {
  // The reply carries the practice run's status as it was; it is read again on arrival.
  const [state, setState] = useState(() => ({ status: ["none", "running", "done", "failed"].includes(data?.status) ? data.status : "loading", summary: data?.summary ?? null }));
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState(null);
  const timer = useRef(null);

  const poll = async () => {
    clearTimeout(timer.current);
    try {
      const res = await practiceStatus();
      const status = ["none", "running", "done", "failed"].includes(res?.status) ? res.status : "none";
      setState({ status, summary: res?.summary ?? null });
      if (status === "running") timer.current = setTimeout(poll, PRACTICE_POLL_MS);
    } catch (err) {
      setState({ status: "none", summary: null });
      setProblem(saveError(err));
    }
  };
  useEffect(() => {
    poll();
    return () => clearTimeout(timer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setStarting(true);
    setProblem(null);
    try {
      const res = await startPractice();
      const status = ["running", "done", "failed"].includes(res?.status) ? res.status : "running";
      setState({ status, summary: null });
      timer.current = setTimeout(poll, status === "running" ? PRACTICE_POLL_MS : 0);
    } catch (err) {
      setProblem(saveError(err));
    } finally {
      setStarting(false);
    }
  };

  const lines = practiceLines(state.summary);
  const { status } = state;
  return (
    <FormShell
      label="Practice run"
      error={problem}
      actions={
        status === "done" ? (
          <Button loading={starting} onClick={start}>Run it again</Button>
        ) : status === "running" || status === "loading" ? (
          <Button kind="primary" loading disabled>{status === "running" ? "Running…" : "Checking…"}</Button>
        ) : (
          <Button kind="primary" loading={starting} onClick={start}>{status === "failed" ? "Try again" : "Start the practice run"}</Button>
        )
      }
    >
      <p className="text-by-body-sm text-by-text-2">It runs on your real data, but changes nothing in Meta and sends nothing to Slack.</p>
      {status === "running" && <p role="status" className="text-by-body-sm text-by-muted">Working through your clients. This can take a minute.</p>}
      {status === "failed" && <Notice tone="danger">The practice run didn’t finish.</Notice>}
      {status === "done" && (
        lines.length ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-by-body-sm">
            {lines.map((l) => (
              <div key={l.key} className="contents">
                <dt className="text-by-muted">{l.label}</dt>
                <dd className="font-semibold tabular-nums text-by-text">{l.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-by-body-sm text-by-text">The practice run finished.</p>
        )
      )}
    </FormShell>
  );
}

/** What counts as booked and as closed: a tag or a pipeline stage, from the account's GoHighLevel. */
export function OutcomesForm({ initial, data: block, onSubmit, saveLabel }) {
  // The reply carries the choices (`options`); the route is asked only when it doesn't.
  const given = block?.options && typeof block.options === "object" ? block.options : null;
  const { data: fetched, error: loadError, isLoading } = useSWR(given ? null : OUTCOME_OPTIONS_KEY, fetcher, { revalidateOnFocus: false });
  const data = given ?? fetched;
  const choices = useMemo(() => outcomeChoices(data), [data]);
  const [booked, setBooked] = useState(outcomeId(initial?.booked));
  const [closed, setClosed] = useState(outcomeId(initial?.closed));
  const { busy, error, setError, run } = useSave(onSubmit);
  const options = [
    { value: "", label: "Pick one" },
    ...choices.tags.map((c) => ({ value: c.id, label: `Tag: ${c.label}` })),
    ...choices.stages.map((c) => ({ value: c.id, label: `Stage: ${c.label}` })),
  ];
  const save = () => {
    const out = outcomesBody(choices, booked, closed);
    if (out.error) return setError(out.error);
    run(out.body);
  };
  return (
    <FormShell label="Booked and closed" error={error} busy={busy} onSave={save} saveLabel={saveLabel}>
      {loadError ? (
        <Notice tone="warning">I couldn’t load your tags and pipelines. Check GoHighLevel is connected, then try again.</Notice>
      ) : isLoading ? (
        <div aria-busy="true" aria-label="Loading tags and pipelines" className="flex flex-col gap-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
      ) : choices.all.length === 0 ? (
        <p className="text-by-body-sm text-by-muted">GoHighLevel has no tags or pipeline stages yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <NativeSelectField label="A lead is booked when" options={options} value={booked} onChange={(e) => setBooked(e.target.value)} />
          <NativeSelectField label="A deal is closed when" options={options} value={closed} onChange={(e) => setClosed(e.target.value)} />
        </div>
      )}
    </FormShell>
  );
}
