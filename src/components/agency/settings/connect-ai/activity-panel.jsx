"use client";

// One AI activity entry: what was asked, what Birdy did and what it cost.
// A column beside the log from 768px; below that it covers the screen and
// behaves as a modal dialog, with a Back button.

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Button, Pill, Skeleton, cn } from "@/components/by";
import { apiRequest } from "@/lib/api";
import { ACCESS_LABEL, formatClock, formatCredits, formatWhenLong, kindLabel, prettyArgs } from "@/lib/connect-ai";
import { AppTile } from "./app-tile";

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
const FULL_SCREEN = "(max-width: 767px)";
const isFullScreen = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(FULL_SCREEN).matches;
const BOX = "mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-by-md border border-by-line bg-by-canvas px-3 py-2.5 text-by-body-sm text-by-text-2";

function Section({ title, children }) {
  return (
    <section className="mt-5">
      <h4 className="text-by-label font-semibold uppercase tracking-[0.07em] text-by-muted">{title}</h4>
      {children}
    </section>
  );
}

function CreditLine({ label, value, total = false }) {
  return (
    <div className={cn("flex justify-between gap-3 py-0.5", total && "mt-1 border-t border-by-line-soft pt-1.5 font-semibold text-by-text")}>
      <span>{label}</span>
      <span className="tabular-nums">{formatCredits(value)}</span>
    </div>
  );
}

/**
 * @param {string} props.id the entry to show
 * @param {() => void} props.onClose
 * @param {(id: string) => void} props.onOpen shows another entry (the related preview or confirmation)
 */
export function ActivityPanel({ id, onClose, onOpen }) {
  const panelRef = useRef(null);
  const [modal, setModal] = useState(isFullScreen);
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState(false);
  const [related, setRelated] = useState(null); // { id, at, label }

  useEffect(() => {
    let live = true;
    setEntry(null);
    setError(false);
    setRelated(null);
    (async () => {
      try {
        const res = await apiRequest(`/api/mcp/activity/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error("load failed");
        const data = await res.json();
        if (!live) return;
        setEntry(data);
        try {
          if (data.confirmed_after) {
            const r = await apiRequest(`/api/mcp/activity/${encodeURIComponent(data.confirmed_after)}`);
            if (r.ok && live) {
              const p = await r.json();
              if (p?.created_at) setRelated({ id: data.confirmed_after, at: p.created_at, label: "Confirmed after the preview at" });
            }
          } else if (data.kind === "preview") {
            const r = await apiRequest(`/api/mcp/activity?confirmed_after=${encodeURIComponent(id)}&from=${String(data.created_at).slice(0, 10)}&limit=1`);
            if (r.ok && live) {
              const hit = (await r.json())?.items?.[0];
              if (hit?.created_at) setRelated({ id: hit.id, at: hit.created_at, label: "Confirmed at" });
            }
          }
        } catch {
          // The related line is a nicety; leave it out.
        }
      } catch {
        if (live) setError(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(FULL_SCREEN);
    const onChange = () => setModal(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Take focus on open and give it back to the row that opened it.
  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus?.();
    };
  }, []);

  useEffect(() => {
    if (!modal) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modal]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") return onClose();
      // Full screen, keep Tab inside the panel, wrapping at either end.
      if (e.key !== "Tab" || !modal || !panelRef.current) return undefined;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((el) => !el.hasAttribute("disabled"));
      if (!items.length) {
        e.preventDefault();
        panelRef.current.focus();
        return undefined;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = panelRef.current.contains(active);
      if (e.shiftKey && (active === first || active === panelRef.current || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
      return undefined;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, modal]);

  const args = entry ? prettyArgs(entry.args) : null;
  const credits = entry?.credits || {};
  const clients = (entry?.clients || []).map((c) => c.name).filter(Boolean);
  const failed = entry && (entry.kind === "refused" || entry.result_status === "error");

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal={modal ? "true" : "false"}
      aria-label="Activity details"
      tabIndex={-1}
      className="fixed inset-0 z-50 overflow-y-auto bg-by-surface p-4 font-by-body text-by-body text-by-text outline-none md:static md:z-auto md:max-h-[480px] md:border-l md:border-by-line md:p-4.5"
    >
      <div className="flex items-start justify-between gap-3">
        <Button kind="ghost" size="sm" className="-ml-2 text-by-accent md:hidden" onClick={onClose}>
          <ArrowLeft aria-hidden="true" />Back to activity
        </Button>
        <Button kind="ghost" size="sm" iconOnly aria-label="Close details" className="ml-auto hidden md:inline-flex" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>

      {error ? (
        <p className="mt-4 text-by-body-sm text-by-danger">Couldn&apos;t load this entry. Close it and try again.</p>
      ) : !entry ? (
        <div className="mt-4 flex flex-col gap-2.5" aria-label="Loading">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="w-1/2" />
          <Skeleton className="h-20 w-full rounded-by-md" />
        </div>
      ) : (
        <div className="mt-3 md:-mt-6">
          <h3 className="pr-8 font-by-display text-by-heading font-semibold">{entry.summary}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-by-body-sm text-by-muted">
            <span>{formatWhenLong(entry.created_at)}</span>·
            <span className="inline-flex items-center gap-1.5"><AppTile name={entry.app_name} className="size-5 text-[10px]" />{entry.app_name}{entry.revoked ? " (disconnected)" : ""}</span>
            {ACCESS_LABEL[entry.access] && <>·<span>{ACCESS_LABEL[entry.access]}</span></>}
          </p>

          <dl className="mt-3 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-by-body-sm">
            {entry.tool_label && (<><dt className="text-by-muted">Tool</dt><dd className="break-words">{entry.tool_label}</dd></>)}
            {clients.length > 0 && (<><dt className="text-by-muted">Client</dt><dd className="break-words">{clients.join(", ")}</dd></>)}
            <dt className="text-by-muted">Result</dt>
            <dd>
              <Pill tone={failed ? "danger" : "success"}>
                {entry.kind === "refused" ? kindLabel("refused", entry.refusal_reason) : entry.result_status === "error" ? "Didn't go through" : "Done"}
              </Pill>
            </dd>
            {related && (
              <>
                <dt className="text-by-muted">Confirmed</dt>
                <dd>
                  {related.label}{" "}
                  <button type="button" onClick={() => onOpen(related.id)} className="cursor-pointer font-semibold text-by-accent hover:underline">{formatClock(related.at)}</button>
                </dd>
              </>
            )}
          </dl>

          {args && (
            <Section title="What was asked">
              <pre className={cn(BOX, "font-mono text-by-caption")}>{args}</pre>
            </Section>
          )}
          {(entry.result_excerpt || entry.link) && (
            <Section title="What Birdy did">
              <div className={BOX}>
                {entry.result_excerpt}
                {entry.link && (
                  <>
                    {entry.result_excerpt ? " " : ""}
                    <a href={entry.link} className="font-semibold text-by-accent hover:underline">Open in Birdy →</a>
                  </>
                )}
              </div>
            </Section>
          )}

          <Section title="Credits">
            <div className="mt-1.5 text-by-body-sm text-by-text-2">
              <CreditLine label="Request" value={credits.request} />
              <CreditLine label={`Data returned (${(entry.response_chars || 0).toLocaleString("en-US")} characters)`} value={credits.data} />
              <CreditLine label="Live change" value={credits.live} />
              <CreditLine label="Total" value={credits.total} total />
            </div>
          </Section>
        </div>
      )}
    </aside>
  );
}
