"use client";

// The conversation with the lead, newest at the bottom like a phone: calls from
// Birdy's call log and from GoHighLevel interleaved with the GoHighLevel texts
// and emails, grouped by day. A filter (All · Messages · Calls) and a search that
// steps through its matches sit above it; the composer sits under it.
// Message bodies are always text: email arrives with its tags stripped, and
// nothing here is set as HTML.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, MessageSquare, Phone, Search, X } from "lucide-react";
import { Button, EmptyState, Segmented, Skeleton, cn } from "@/components/by";
import { dialerName, findHits, timeOf } from "@/lib/lead-view";
import { CallCard } from "./call-card";
import { Marked } from "./marked";

const shows = (view) => (item) => view === "all" || (view === "calls") === (item.kind === "call");

function Bubble({ message, query, base, current }) {
  const out = message.direction === "outbound";
  const attachments = message.attachments || [];
  return (
    <div className={cn("flex max-w-[min(78%,32rem)] flex-col gap-1", out ? "items-end self-end" : "items-start self-start")}>
      <div
        className={cn(
          "rounded-by-lg px-3.5 py-2 text-by-body leading-[1.45] break-words whitespace-pre-wrap",
          out ? "rounded-br-by-sm border border-by-accent-line bg-by-accent-soft text-by-text" : "rounded-bl-by-sm border border-by-line bg-by-surface text-by-text",
        )}
      >
        {message.subject && <b className="mb-0.5 block font-semibold"><Marked text={message.subject} query={query} base={base("subject")} current={current} /></b>}
        {message.body && <Marked text={message.body} query={query} base={base("body")} current={current} />}
        {attachments.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-x-3 text-by-body-sm underline">
            {attachments.map((url, i) => (
              <a key={`${i}-${url}`} href={url} target="_blank" rel="noopener noreferrer">{`Attachment ${i + 1}`}</a>
            ))}
          </span>
        )}
      </div>
      <span className="px-1 text-by-caption text-by-muted">{[message.channel, timeOf(message.date)].filter(Boolean).join(" · ")}</span>
    </div>
  );
}

function StatusNote({ status, onRetry }) {
  if (status === "reconnect") {
    return (
      <p className="text-center text-by-caption text-by-muted">
        Reconnect GoHighLevel in Settings to see and send messages.{" "}
        <Link href="/settings" className="font-semibold text-by-accent hover:underline">Open Settings</Link>
      </p>
    );
  }
  if (status === "unavailable") {
    return (
      <p className="text-center text-by-caption text-by-muted">
        Messages couldn’t be loaded.{" "}
        <button type="button" onClick={onRetry} className="cursor-pointer font-semibold text-by-accent hover:underline">Try again</button>
      </p>
    );
  }
  return null;
}

/**
 * @param {object[]} props.items threadItems(), oldest first
 * @param {"loading"|"ok"|"reconnect"|"unavailable"} props.messagesStatus
 * @param {{key: string, n: number}|null} [props.jump] a call picked on the Calls tab: scroll to it and flash it
 * @param {string|null} [props.selectedKey] the call kept marked while the Calls tab is open
 * @param {React.ReactNode} props.composer
 */
export function LeadThread({ items, firstName, messagesStatus, messagesNote, onRetry, jump = null, selectedKey = null, composer, className }) {
  const [view, setView] = useState("all");
  const [openCall, setOpenCall] = useState(null);
  const [findOpen, setFindOpen] = useState(false);
  const [find, setFind] = useState("");
  const [cur, setCur] = useState(0);
  // GoHighLevel transcripts fetched so far, by item key, so the search finds them.
  const [transcripts, setTranscripts] = useState({});
  const scroller = useRef(null);
  const findButton = useRef(null);

  const loading = messagesStatus === "loading";
  const msgs = items.filter((i) => i.kind !== "call").length;
  const calls = items.length - msgs;
  const q = findOpen ? find.trim() : "";
  const { hits, start } = useMemo(() => findHits(items, q, transcripts), [items, q, transcripts]);
  const shown = items.filter(shows(view));
  const days = shown.reduce((list, item) => {
    const last = list[list.length - 1];
    if (last?.day === item.day) last.items.push(item);
    else list.push({ day: item.day, items: [item] });
    return list;
  }, []);

  // Open (and switch filters) on the newest item.
  useEffect(() => {
    const s = scroller.current;
    if (s) s.scrollTop = s.scrollHeight;
  }, [view, items.length, loading]);

  /** Move to match n: show its item (All if the filter hides it), open its transcript if it's in one. */
  const goHit = (n) => {
    const h = hits[n];
    if (!h) return setCur(0);
    setCur(n);
    const item = items.find((i) => i.key === h.key);
    if (item && !shows(view)(item)) setView("all");
    if (h.field === "transcript" && openCall !== h.key) setOpenCall(h.key);
  };
  // A new search starts at its first match.
  useEffect(() => {
    goHit(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  useEffect(() => {
    const s = scroller.current;
    const el = s?.querySelector("mark[data-current]");
    if (!s || !el) return;
    s.scrollTo?.({ top: el.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop - s.clientHeight / 3, behavior: "smooth" });
  }, [q, cur, openCall, view]);

  // A call picked on the Calls tab: All if Messages hides it, then scroll to it.
  useEffect(() => {
    if (!jump) return;
    if (view === "messages") setView("all");
    const id = requestAnimationFrame(() => {
      const s = scroller.current;
      const el = s?.querySelector(`[data-key="${CSS.escape(jump.key)}"]`);
      if (s && el) s.scrollTo?.({ top: el.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop - 56, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);

  const step = (d) => hits.length && goHit((cur + d + hits.length) % hits.length);
  const closeFind = () => {
    setFindOpen(false);
    setFind("");
    setCur(0);
    requestAnimationFrame(() => findButton.current?.focus());
  };
  const baseFor = (key) => (field) => start.get(`${key}|${field}`);

  return (
    <section aria-label="Conversation" className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-by-lg border border-by-line bg-by-canvas shadow-by-card", className)}>
      {items.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-by-line-soft px-4 py-2.5">
          <span aria-hidden="true" className="text-by-caption font-semibold text-by-muted">Conversation</span>
          <Segmented
            aria-label="Show in the conversation"
            value={view}
            onValueChange={setView}
            items={[{ value: "all", label: "All", count: items.length }, { value: "messages", label: "Messages", count: msgs }, { value: "calls", label: "Calls", count: calls }]}
          />
          {findOpen ? (
            <div
              role="search"
              className="flex h-8 w-full max-w-80 items-center gap-1 rounded-full border border-by-line bg-by-surface pr-1 pl-2.5 focus-within:border-by-accent sm:w-auto sm:flex-1"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  closeFind();
                }
              }}
            >
              <Search aria-hidden="true" className="size-3.5 shrink-0 text-by-muted" />
              <input
                autoFocus
                placeholder="Search this conversation"
                aria-label="Search this conversation"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    step(e.shiftKey ? -1 : 1);
                  }
                }}
                className="min-w-0 flex-1 bg-transparent font-by-body text-by-body-sm text-by-text outline-none placeholder:text-by-muted"
              />
              {q && <span aria-live="polite" className={cn("whitespace-nowrap text-by-caption tabular-nums", hits.length ? "text-by-text-2" : "text-by-muted")}>{hits.length ? `${Math.min(cur, hits.length - 1) + 1} of ${hits.length}` : "No matches"}</span>}
              {q && hits.length > 0 && (
                <>
                  <Button kind="ghost" size="sm" iconOnly className="size-6 rounded-full" aria-label="Previous match" onClick={() => step(-1)}><ChevronUp aria-hidden="true" /></Button>
                  <Button kind="ghost" size="sm" iconOnly className="size-6 rounded-full" aria-label="Next match" onClick={() => step(1)}><ChevronDown aria-hidden="true" /></Button>
                </>
              )}
              <Button kind="ghost" size="sm" iconOnly className="size-6 rounded-full" aria-label="Close search" onClick={closeFind}><X aria-hidden="true" /></Button>
            </div>
          ) : (
            <Button ref={findButton} kind="ghost" size="sm" iconOnly className="rounded-full" aria-label="Search this conversation" onClick={() => setFindOpen(true)}>
              <Search aria-hidden="true" />
            </Button>
          )}
        </div>
      )}

      <div ref={scroller} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 md:px-6">
        {loading ? (
          <div aria-busy="true" aria-label="Loading the conversation" className="m-auto flex w-full max-w-sm flex-col gap-3 py-10">
            <Skeleton className="h-8 w-2/3 rounded-by-lg" />
            <Skeleton className="h-8 w-1/2 self-end rounded-by-lg" />
            <Skeleton className="h-8 w-3/5 rounded-by-lg" />
          </div>
        ) : (
          <>
            {messagesStatus === "ok" && messagesNote && <p className="pt-3 text-center text-by-caption text-by-muted">{messagesNote}</p>}
            {items.length === 0 && messagesStatus === "ok" && (
              <EmptyState icon={<MessageSquare />} title="No messages yet" className="my-auto">
                {firstName ? `Send ${firstName} the first text below.` : "Send the first text below."} Calls show here too.
              </EmptyState>
            )}
            {items.length > 0 && days.length === 0 && (
              <EmptyState icon={view === "calls" ? <Phone /> : <MessageSquare />} title={view === "calls" ? "No calls yet" : "No messages yet"} className="my-auto">
                {view === "calls" ? "Calls show here, with recordings and transcripts." : "Texts and emails show here."}
              </EmptyState>
            )}
            {days.map(({ day, items: dayItems }) => (
              <div key={day} className="flex flex-col gap-3 pb-3">
                <div className="sticky top-0 z-10 -mx-4 flex justify-center bg-by-canvas px-4 py-2 md:-mx-6">
                  <span className="rounded-full border border-by-line bg-by-surface px-3 py-0.5 text-by-caption text-by-muted shadow-by-raised">{day}</span>
                </div>
                {dayItems.map((item) =>
                  item.kind === "call" ? (
                    <div
                      key={item.key}
                      data-key={item.key}
                      className={cn("flex w-full flex-col gap-1", openCall === item.key ? "self-stretch" : item.direction === "inbound" ? "max-w-[26rem] items-start self-start" : "max-w-[26rem] items-end self-end")}
                    >
                      <CallCard
                        call={item}
                        open={openCall === item.key}
                        onToggle={() => setOpenCall(openCall === item.key ? null : item.key)}
                        onTranscript={(text) => setTranscripts((t) => ({ ...t, [item.key]: text }))}
                        query={q}
                        base={baseFor(item.key)}
                        current={cur}
                        selected={selectedKey === item.key}
                      />
                      <span className="px-1 text-by-caption text-by-muted">{["Call", timeOf(item.started_at), dialerName(item.source)].filter(Boolean).join(" · ")}</span>
                    </div>
                  ) : (
                    <Bubble key={item.key} message={item} query={q} base={baseFor(item.key)} current={cur} />
                  ),
                )}
              </div>
            ))}
            <div className="mt-auto pt-2">
              <StatusNote status={messagesStatus} onRetry={onRetry} />
            </div>
          </>
        )}
      </div>
      {composer}
    </section>
  );
}
