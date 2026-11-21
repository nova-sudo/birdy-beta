"use client";

// One call in the conversation: direction and length, then Play and Transcript.
//
// A dialer's recording_url plays as it is. A call made in GoHighLevel carries
// recording_path / transcript_path instead: GoHighLevel needs the agency's token,
// so the audio and transcript come through Birdy's backend, fetched only when
// someone presses Play or opens the transcript. 404 means there is none, 409
// means GoHighLevel needs reconnecting.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Phone, Play } from "lucide-react";
import { Button, cn } from "@/components/by";
import { apiRequest } from "@/lib/api";
import { answered, callLabel, transcriptText } from "@/lib/lead-view";
import { Marked } from "./marked";

function ReconnectNote({ what }) {
  return (
    <p className="text-by-caption text-by-muted">
      Reconnect GoHighLevel to {what}.{" "}
      <Link href="/settings" className="font-semibold text-by-accent hover:underline">Open Settings</Link>
    </p>
  );
}

/** The recording: "Play", then the player, already playing. */
function Recording({ call, label }) {
  // "idle" | "loading" | "ready" | "none" | "reconnect" | "error"
  const [state, setState] = useState("idle");
  const [src, setSrc] = useState(null);
  const audio = useRef(null);
  const mounted = useRef(true);

  // A blob URL lives as long as the card.
  useEffect(() => () => src?.startsWith("blob:") && URL.revokeObjectURL(src), [src]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (state === "ready") audio.current?.play?.()?.catch?.(() => {});
  }, [state]);

  const load = async () => {
    if (state === "loading") return;
    if (!call.recording_path) {
      setSrc(call.recording_url);
      return setState("ready");
    }
    setState("loading");
    try {
      const res = await apiRequest(call.recording_path);
      if (!mounted.current) return;
      if (res.status === 404) return setState("none");
      if (res.status === 409) return setState("reconnect");
      if (!res.ok) throw new Error(`The recording request failed (${res.status}).`);
      const blob = await res.blob();
      // A card that went away mid-download never makes a URL it can't revoke.
      if (!mounted.current) return;
      setSrc(URL.createObjectURL(blob));
      setState("ready");
    } catch {
      if (mounted.current) setState("error");
    }
  };

  if (state === "ready" && src) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption -- a phone call has no caption track
      <audio ref={audio} controls src={src} className="h-9 w-full" aria-label={`Recording: ${label}`}>
        <a href={src}>Download the recording</a>
      </audio>
    );
  }
  if (state === "none") return <p className="text-by-caption text-by-muted">No recording for this call.</p>;
  if (state === "reconnect") return <ReconnectNote what="play call recordings" />;
  return (
    <span className="flex items-center gap-2">
      <Button kind="soft" size="sm" className="h-7 rounded-full px-2.5" onClick={load} loading={state === "loading"} aria-label={`Play recording: ${label}`}>
        <Play aria-hidden="true" className="size-3!" />
        {state === "loading" ? "Loading…" : "Play"}
      </Button>
      {state === "error" && <span className="text-by-caption text-by-danger">Couldn’t load the recording.</span>}
    </span>
  );
}

/** A GoHighLevel call's transcript, fetched the first time it opens. Reports the text so the thread search can find it. */
function useGhlTranscript(path, open, onText) {
  // "idle" | "loading" | "ready" | "reconnect" | "error"
  const [state, setState] = useState("idle");
  const [text, setText] = useState(null);
  const report = useRef(onText);
  report.current = onText;

  const load = async () => {
    setState("loading");
    try {
      const res = await apiRequest(path);
      if (res.status === 409) return setState("reconnect");
      if (res.status === 404) {
        setText(null);
        return setState("ready");
      }
      if (!res.ok) throw new Error(`The transcript request failed (${res.status}).`);
      const t = (await res.json())?.transcript || null;
      setText(t);
      setState("ready");
      if (t) report.current?.(t);
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    if (path && open && state === "idle") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once, on the first open
  }, [path, open]);

  return { state, text, retry: load };
}

/**
 * @param {object} props.call a call from the lead (call_logs or GoHighLevel)
 * @param {boolean} props.open whether its transcript is open
 * @param {() => void} props.onToggle opens or closes the transcript
 * @param {(text: string) => void} [props.onTranscript] a fetched GoHighLevel transcript, for the search
 * @param {string} [props.query] the thread search
 * @param {(field: string) => number|undefined} [props.base] the first match number in a field
 * @param {number} [props.current] the current match
 * @param {boolean} [props.selected] marked from the Calls tab
 */
export function CallCard({ call, open, onToggle, onTranscript, query = "", base = () => undefined, current = -1, selected = false }) {
  const label = callLabel(call);
  const reached = answered(call);
  const hasRecording = Boolean(call.recording_path || call.recording_url);
  const dialerText = transcriptText(call.transcript);
  const hasTranscript = Boolean(call.transcript_path || dialerText);
  const ghl = useGhlTranscript(call.transcript_path, open, onTranscript);

  return (
    <div
      className={cn(
        "w-full max-w-[26rem] rounded-by-lg border bg-by-surface px-3 py-2.5 shadow-by-raised transition-shadow",
        open && "max-w-none",
        selected ? "border-by-accent ring-2 ring-by-accent-line" : "border-by-line",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className={cn("grid size-7 shrink-0 place-items-center rounded-full [&_svg]:size-3.5", reached ? "bg-by-accent-soft text-by-accent" : "bg-by-sunken text-by-muted")}>
          <Phone />
        </span>
        <span className="min-w-0 flex-1 truncate text-by-body-sm font-semibold text-by-text">
          <Marked text={label} query={query} base={base("card")} current={current} />
        </span>
        {hasTranscript && (
          <Button kind="ghost" size="sm" className="h-7 px-2" aria-expanded={open} onClick={onToggle}>
            Transcript
            <ChevronDown aria-hidden="true" className={cn("size-3.5! transition-transform", open && "rotate-180")} />
          </Button>
        )}
      </div>
      {hasRecording ? (
        <div className="mt-2"><Recording call={call} label={label} /></div>
      ) : (
        reached && <p className="mt-1.5 text-by-caption text-by-muted">No recording</p>
      )}
      {open && (
        <div className="mt-2.5 max-h-72 overflow-y-auto border-t border-by-line-soft pt-2.5 text-by-body-sm text-by-text-2">
          {call.transcript_path ? (
            <>
              {ghl.state === "loading" && <p className="text-by-muted">Loading transcript…</p>}
              {ghl.state === "ready" && (ghl.text
                ? <p className="whitespace-pre-line"><Marked text={ghl.text} query={query} base={base("transcript")} current={current} /></p>
                : <p className="text-by-muted">No transcript for this call.</p>)}
              {ghl.state === "reconnect" && <ReconnectNote what="read call transcripts" />}
              {ghl.state === "error" && (
                <p className="text-by-muted">
                  Couldn’t load the transcript.{" "}
                  <button type="button" onClick={ghl.retry} className="cursor-pointer font-semibold text-by-accent hover:underline">Try again</button>
                </p>
              )}
            </>
          ) : (
            <p className="whitespace-pre-line"><Marked text={dialerText} query={query} base={base("transcript")} current={current} /></p>
          )}
        </div>
      )}
    </div>
  );
}
