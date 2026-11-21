"use client";

// The lead view's left column: Profile, Journey, Calls and Ads.

import { useState } from "react";
import Link from "next/link";
import { Calendar, Check, ChevronRight, Copy, Expand, Megaphone, Phone, RefreshCw, Route } from "lucide-react";
import { BirdyAvatar, Button, Dialog, DialogBody, DialogContent, EmptyState, Skeleton, Tooltip, cn } from "@/components/by";
import { cameFrom, timeAgo } from "@/lib/lead-detail";
import { callLabel, callStats, createdLabel, firstReplySeconds, localStamp, platformLabel, span, stamp, tagsNewestFirst, talk, touchWhen } from "@/lib/lead-view";
import { useNow } from "./use-lead-summary";

/** One block of the pane: a small heading and what's under it. The first has no rule above it. */
function Sec({ title, aside, className, children }) {
  return (
    <section className={cn("border-t border-by-line-soft py-3.5 first:border-t-0 first:pt-1", className)}>
      {title && (
        <h3 className="mb-2.5 flex items-baseline gap-1.5 text-by-body-sm font-semibold text-by-text">
          {title}
          {aside != null && <span className="text-by-caption font-medium text-by-muted tabular-nums">{aside}</span>}
        </h3>
      )}
      {children}
    </section>
  );
}

/** Label and value rows: the label muted on the left, the value beside it. */
function Rows({ rows }) {
  return (
    <dl className="grid grid-cols-[6.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-by-body-sm">
      {rows.filter(Boolean).map(([label, value]) => (
        <div key={typeof label === "string" ? label : label.key} className="contents">
          <dt className="text-by-muted">{label}</dt>
          <dd className="min-w-0 break-words text-by-text">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function CopyButton({ value, label }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    }, () => {});
  };
  return (
    <Button kind="ghost" size="sm" iconOnly className="-my-1.5 size-6 shrink-0 [&_svg]:size-3.5" aria-label={done ? `${label} copied` : `Copy ${label.toLowerCase()}`} title={`Copy ${label.toLowerCase()}`} onClick={copy}>
      {done ? <Check aria-hidden="true" className="text-by-success" /> : <Copy aria-hidden="true" />}
    </Button>
  );
}

const withCopy = (value, label, numeric) =>
  value ? (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={cn("min-w-0 break-all", numeric && "tabular-nums")}>{value}</span>
      <CopyButton value={value} label={label} />
    </span>
  ) : "—";

/** Birdy's read of the lead: the AI summary, with regenerate, and its stale, out-of-credits and failed states. */
function BirdysRead({ data, busy, onRefresh }) {
  const now = useNow(60_000);
  if (data?.status === "unavailable") return null;
  const loading = data === null || data?.status === "generating";
  const status = data?.status;
  const text = data?.summary;
  const when = timeAgo(data?.generated_at, now);
  return (
    <section aria-label="Birdy's read" className="mb-3.5 rounded-by-lg border border-by-accent-line bg-by-accent-soft px-3 pt-2.5 pb-3">
      <div className="flex items-center gap-2">
        <BirdyAvatar size={24} />
        <h3 className="text-by-body-sm font-semibold text-by-accent">Birdy’s read</h3>
        <span className="ml-auto flex items-center gap-1">
          {when && <span className="text-by-caption text-by-muted">{when}</span>}
          <Button kind="ghost" size="sm" iconOnly className="size-6 [&_svg]:size-3.5" onClick={onRefresh} disabled={busy || loading} aria-label="Regenerate summary" title="Regenerate summary">
            <RefreshCw aria-hidden="true" className={cn(busy && "motion-safe:animate-spin")} />
          </Button>
        </span>
      </div>
      <div aria-live="polite" className="mt-1.5 text-by-body-sm leading-[1.5] text-by-text-2">
        {(loading || (busy && !text)) && <p className="text-by-muted">Writing a summary…</p>}
        {text && <p>{text}</p>}
        {status === "ok" && data.stale && <p className="mt-1.5 text-by-caption text-by-warning">New activity since this summary.</p>}
        {status === "blocked" && (
          <p className="mt-1.5">
            You’re out of credits. <Link href="/credits" className="font-semibold text-by-accent hover:underline">Top up</Link> to generate AI summaries.
          </p>
        )}
        {status === "failed" && !busy && (
          <p className="mt-1.5">
            Couldn’t write the summary.{" "}
            <button type="button" onClick={onRefresh} className="cursor-pointer font-semibold text-by-accent hover:underline">Try again</button>
          </p>
        )}
      </div>
    </section>
  );
}

const TAGS_SHOWN = 4;

/** Contact details, how the lead came in, and its tags. Status, stage and client are in the header. */
export function ProfilePane({ lead, items, itemsReady, summary }) {
  const contact = lead.contact || {};
  const [allTags, setAllTags] = useState(false);
  const tags = tagsNewestFirst(contact.tags);
  const reply = firstReplySeconds(items, contact.date_added);
  return (
    <>
      {summary && <BirdysRead {...summary} />}
      <Sec title="Contact">
        <Rows rows={[["Phone", withCopy(contact.phone, "Phone", true)], ["Email", withCopy(contact.email, "Email")]]} />
      </Sec>
      <Sec title="Lead">
        <Rows
          rows={[
            ["Came in via", cameFrom(lead)],
            ["Created", createdLabel(contact.date_added)],
            [
              <Tooltip key="reply" label="From the lead arriving to the team's first text, email or call.">
                <span tabIndex={0} className="cursor-help underline decoration-by-line-strong decoration-dotted underline-offset-2">First reply</span>
              </Tooltip>,
              !itemsReady ? <Skeleton className="mt-1 w-16" /> : reply == null ? "None yet" : span(reply),
            ],
            lead.opportunities?.[0]?.pipeline_name && ["Pipeline", lead.opportunities[0].pipeline_name],
          ]}
        />
      </Sec>
      <Sec title="Tags" aside={tags.length}>
        {tags.length === 0 ? (
          <p className="text-by-body-sm text-by-muted">No tags.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {(allTags ? tags : tags.slice(0, TAGS_SHOWN)).map((t) => (
              <span key={t} className="rounded-by-sm bg-by-sunken px-2 py-0.5 text-by-caption text-by-text-2">{t}</span>
            ))}
            {tags.length > TAGS_SHOWN && (
              <button type="button" onClick={() => setAllTags(!allTags)} className="cursor-pointer rounded-by-sm px-1 text-by-caption font-semibold text-by-accent hover:underline">
                {allTags ? "Show fewer" : `+${tags.length - TAGS_SHOWN} more`}
              </button>
            )}
          </div>
        )}
      </Sec>
    </>
  );
}

/** The marker colour of a Journey step: won green, lost red, appointments and conversions a quiet purple, the rest grey. */
function stepTone(event) {
  if (/\bwon\b/i.test(event.title)) return "border-by-success-solid bg-by-success-solid";
  if (/\b(lost|abandoned)\b/i.test(event.title)) return "border-by-danger-solid bg-by-danger-solid";
  if (event.kind === "appointment" || event.kind === "conversion") return "border-by-accent-line bg-by-accent-soft";
  return "border-by-line-strong bg-by-surface";
}

function GhlNote({ ghl }) {
  if (ghl === "reconnect") {
    return (
      <p aria-live="polite" className="mt-3 text-by-caption text-by-muted">
        Reconnect GoHighLevel to include appointments and pipeline history.{" "}
        <Link href="/settings" className="font-semibold text-by-accent hover:underline">Open Settings</Link>
      </p>
    );
  }
  if (ghl === "unavailable") return <p aria-live="polite" className="mt-3 text-by-caption text-by-muted">Appointments and pipeline history couldn’t be loaded.</p>;
  return null;
}

/** The lead's timeline, newest first, as the endpoint sends it. The endpoint writes the words; this lays them out. */
export function JourneyPane({ journey, status, onRetry }) {
  const events = journey?.events || [];
  return (
    <Sec title="Customer journey" aside="newest first">
      {status === "loading" && (
        <div aria-busy="true" aria-label="Loading journey" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="w-full" />)}
        </div>
      )}
      {status === "error" && (
        <p aria-live="polite" className="text-by-body-sm text-by-muted">
          Couldn’t load the journey.{" "}
          <button type="button" onClick={onRetry} className="cursor-pointer font-semibold text-by-accent hover:underline">Try again</button>
        </p>
      )}
      {status === "ready" && (
        <>
          {events.length === 0 ? (
            <EmptyState icon={<Route />} title="No journey events yet">Ad clicks, forms, calls and pipeline moves show here.</EmptyState>
          ) : (
            <ol>
              {events.map((event, i) => {
                const booked = event.kind === "appointment" && event.starts_at ? (event.starts_at_local ? localStamp(event.starts_at) : stamp(event.starts_at)) : "";
                const at = stamp(event.at);
                return (
                  <li key={event.id ?? i} className="relative flex flex-col gap-0.5 pb-4 pl-5.5 last:pb-0">
                    {i < events.length - 1 && <span aria-hidden="true" className="absolute top-4 -bottom-0.5 left-[7px] w-px bg-by-line-strong" />}
                    <span aria-hidden="true" className={cn("absolute top-1 left-0.5 size-[11px] rounded-full border-2", stepTone(event))} />
                    <b className="text-by-body-sm font-semibold text-by-text">{event.title}</b>
                    {event.detail && <span className="truncate text-by-caption text-by-text-2" title={event.detail}>{event.detail}</span>}
                    {booked && (
                      <span className="flex items-center gap-1.5 text-by-caption font-semibold text-by-text tabular-nums">
                        <Calendar aria-hidden="true" className="size-3 text-by-accent" />
                        {booked}
                      </span>
                    )}
                    {at && (
                      <span className="text-by-caption text-by-muted tabular-nums">
                        {event.kind === "appointment" ? `${event.appointment_status === "booked" ? "Booked" : "Updated"} ${at}` : at}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <GhlNote ghl={journey?.ghl} />
        </>
      )}
    </Sec>
  );
}

/**
 * A short call summary, then one line per call, oldest first like the thread. A line scrolls the
 * thread to that call; the recordings and transcripts live in the thread.
 */
export function CallsPane({ calls, items, selectedKey, onJump }) {
  const list = (items || []).filter((i) => i.kind === "call");
  if (!list.length) {
    return <EmptyState icon={<Phone />} title="No calls yet">Calls from the call centre and GoHighLevel show here and in the conversation, with recordings and transcripts.</EmptyState>;
  }
  const stats = callStats(calls);
  return (
    <>
      <Sec title="Calls">
        <Rows
          rows={[
            ["Answered", <span key="a" className="tabular-nums">{stats.answered} of {stats.total}</span>],
            ["Direction", <span key="d" className="tabular-nums">{stats.inbound} in · {stats.outbound} out</span>],
            stats.talkSeconds > 0 && ["Talk time", <span key="t" className="tabular-nums">{talk(stats.talkSeconds)}</span>],
          ]}
        />
      </Sec>
      <Sec title="History">
        <ul className="-mx-2 flex flex-col gap-px">
          {list.map((call) => {
            const on = selectedKey === call.key;
            return (
              <li key={call.key}>
                <button
                  type="button"
                  aria-current={on || undefined}
                  title="Show this call in the conversation"
                  onClick={() => onJump(call.key)}
                  className={cn(
                    "group flex w-full cursor-pointer items-center gap-2.5 rounded-by-md py-1.5 pr-1.5 pl-2 text-left text-by-body-sm transition-colors",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-by-accent",
                    on ? "bg-by-accent-soft" : "hover:bg-by-sunken",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-by-text">{callLabel(call)}</span>
                  <span className="whitespace-nowrap text-by-caption text-by-muted tabular-nums">{touchWhen(call.started_at)}</span>
                  <ChevronRight aria-hidden="true" className={cn("size-3 shrink-0 transition-colors", on ? "text-by-accent" : "text-by-line-strong group-hover:text-by-accent")} />
                </button>
              </li>
            );
          })}
        </ul>
      </Sec>
    </>
  );
}

const submittedFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
function submittedLabel(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? submittedFormat.format(d) : null;
}

/** The ad the lead came from: its names, copy, creative (click to enlarge) and the lead's form answers. */
export function AdsPane({ attribution, groupId }) {
  const [big, setBig] = useState(false);
  if (!attribution) return <EmptyState icon={<Megaphone />} title="No source ad">Birdy has no ad on record for this lead.</EmptyState>;
  const image = attribution.creative_image || attribution.creative_thumbnail;
  const alt = attribution.creative_title || attribution.ad_name || "Ad creative";
  const answers = attribution.form_answers || [];
  return (
    <>
      <Sec title="Source ad">
        <Rows
          rows={[
            ["Platform", platformLabel(attribution)],
            ["Ad", attribution.ad_name],
            ["Ad set", attribution.adset_name],
            ["Campaign", attribution.campaign_name],
            attribution.creative_body && ["Ad copy", <span key="c" className="whitespace-pre-line">{attribution.creative_body}</span>],
            ["Submitted", submittedLabel(attribution.submitted_at)],
          ]}
        />
        {groupId && (
          <Link href={`/media-buyer/table?client=${encodeURIComponent(groupId)}`} className="mt-3 inline-flex items-center gap-0.5 text-by-body-sm font-semibold text-by-accent hover:underline">
            Open in Media Buyer<ChevronRight aria-hidden="true" className="size-3.5" />
          </Link>
        )}
      </Sec>
      {image && (
        <Sec title="Creative">
          <button
            type="button"
            onClick={() => setBig(true)}
            aria-label={`Enlarge the ad creative: ${alt}`}
            className="group relative block h-52 max-w-full cursor-zoom-in overflow-hidden rounded-by-lg border border-by-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent"
          >
            {/* Ad creatives live on Meta's CDN, which next/image isn't configured for. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-full w-auto object-cover" />
            <span aria-hidden="true" className="absolute top-2 right-2 grid size-6.5 place-items-center rounded-by-md bg-by-text/40 text-by-on-accent [&_svg]:size-3">
              <Expand />
            </span>
          </button>
          <Dialog open={big} onOpenChange={setBig}>
            <DialogContent title="Ad creative" description={attribution.ad_name || undefined} size="xl">
              <DialogBody className="grid place-items-center bg-by-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={alt} className="max-h-[70vh] w-auto rounded-by-lg" />
              </DialogBody>
            </DialogContent>
          </Dialog>
        </Sec>
      )}
      {answers.length > 0 && (
        <Sec title="Form answers" aside={answers.length}>
          <dl className="flex flex-col gap-2.5 text-by-body-sm">
            {answers.map((a, i) => (
              <div key={`${a.question}-${i}`}>
                <dt className="text-by-muted">{a.question}</dt>
                <dd className="mt-0.5 font-medium text-by-text">{a.answer || "—"}</dd>
              </div>
            ))}
          </dl>
        </Sec>
      )}
    </>
  );
}
