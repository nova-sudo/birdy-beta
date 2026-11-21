"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Pill, cn } from "@/components/by";

/**
 * One report in a Reports list, as the reference draws it: its name, what it shows and when, its
 * status and channel, then its next and last run, a chevron to its page, and an optional switch
 * that sits beside the link (never inside it).
 *
 * @param {string} props.href the report's page
 * @param {{tone: string, label: string}} props.status
 * @param {string} props.channel "Slack" or "Birdy"
 * @param {string|null} [props.next] the next run, words; hidden when null
 * @param {string|null} [props.last] the last run, words
 * @param {boolean} [props.off] greys the row, as a paused report
 * @param {React.ReactNode} [props.control] the on/off switch
 */
export function ReportRow({ href, name, what, when, status, channel, next, last, off = false, control }) {
  return (
    <li className="flex items-center gap-3 border-b border-by-line pr-4 last:border-b-0 sm:pr-5">
      <Link
        href={href}
        className={cn(
          "group flex min-w-0 flex-1 flex-col gap-2 py-4 pl-4 outline-none sm:flex-row sm:items-center sm:gap-4 sm:pl-5",
          "focus-visible:rounded-by-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-by-accent",
          off && "opacity-60",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <b className="font-by-display text-by-body-lg font-semibold text-by-text group-hover:text-by-accent">{name}</b>
            <Pill tone={status.tone}>{status.label}</Pill>
            <Pill tone="neutral" dot={false}>{channel}</Pill>
          </span>
          <span className="text-by-body text-by-text-2">{what}</span>
          <span className="text-by-body-sm text-by-muted">{when}</span>
        </span>
        <span className="flex shrink-0 flex-col gap-0.5 text-by-body-sm tabular-nums sm:items-end">
          {next && <span><i className="mr-1.5 not-italic text-by-muted">Next</i><span className="text-by-text">{next}</span></span>}
          <span><i className="mr-1.5 not-italic text-by-muted">Last</i><span className="text-by-text">{last ?? "Not run yet"}</span></span>
        </span>
        <ChevronRight aria-hidden="true" className="hidden size-4 shrink-0 text-by-muted sm:block" />
      </Link>
      {control}
    </li>
  );
}

/** The card the rows sit in. */
export function ReportList({ label, children }) {
  return (
    <ul aria-label={label} className="overflow-hidden rounded-by-lg border border-by-line bg-by-surface shadow-by-card">
      {children}
    </ul>
  );
}
