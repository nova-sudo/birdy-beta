"use client";

import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { Button, Notice } from "@/components/by";
import SlackMessagePreview from "@/components/report-designer/SlackMessagePreview";
import { apiRequest } from "@/lib/api";

/**
 * A Slack report's preview, with today's real numbers, rendered by the server.
 * @param {object} template the report's template
 * @param {"birdy"|"media_buyer"|"sales_coach"} [owner] whose report it is, so the server fills that agent's metrics
 */
export async function reportPreview(template, owner) {
  const body = owner ? { template, owner } : { template };
  const res = await apiRequest("/api/report-designer/preview", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return [{ blocks: json.blocks ?? [], sample: Boolean(json.sample) }];
}

const SAMPLE_NOTE = "Some figures are samples: there isn’t enough data yet to fill them.";

/**
 * The message as Slack will show it, built only when asked, or at once with `auto`.
 * @param {() => Promise<{blocks: object[], sample: boolean, label?: string}[]>} props.load one or more messages, in order
 * @param {string} [props.sampleNote] what to say when the figures are samples
 * @param {React.ReactNode} [props.note] what to say when every figure is real
 * @param {boolean} [props.auto] builds it straight away instead of offering "Show a preview"
 * @param {(status: "idle"|"loading"|"done"|"error") => void} [props.onStatus] told each time the state changes
 */
export function Preview({ load, sampleNote = SAMPLE_NOTE, note = null, auto = false, onStatus }) {
  const [state, setState] = useState({ status: auto ? "loading" : "idle", messages: null });
  const run = async () => {
    setState((s) => ({ ...s, status: "loading" }));
    try {
      setState({ status: "done", messages: await load() });
    } catch {
      setState({ status: "error", messages: null });
    }
  };
  // Once per mount, even when the effect runs twice in development.
  const started = useRef(false);
  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    run();
  }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onStatus?.(state.status); }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.status === "idle") {
    return <Button kind="secondary" size="sm" onClick={run}><Eye aria-hidden="true" />Show a preview</Button>;
  }
  if (state.status === "error") {
    return <Notice tone="danger" action={<Button size="sm" onClick={run}>Retry</Button>}>Couldn’t build the preview.</Notice>;
  }
  const messages = state.messages ?? [{ blocks: null }];
  const sample = messages.some((m) => m.sample);
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          {m.label && <p className="text-by-body-sm font-medium text-by-text-2">{m.label}</p>}
          <SlackMessagePreview blocks={m.blocks} loading={state.status === "loading"} />
        </div>
      ))}
      {state.status === "done" && (sample
        ? <p className="text-by-caption text-by-muted">{sampleNote}</p>
        : note && <p className="flex items-center gap-1.5 text-by-caption text-by-muted"><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-by-success" />{note}</p>)}
    </div>
  );
}
