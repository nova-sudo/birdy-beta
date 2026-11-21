"use client";

// The History tab: every time a rule fired (GET /api/alerts/notifications,
// read and unread, the 50 newest the API keeps). Reading it marks nothing
// as read.

import { BellRing, RefreshCw } from "lucide-react";
import { Button, EmptyState, Notice, Skeleton } from "@/components/by";
import { formatRelative } from "@/lib/alert-helpers";
import { EMPTY_TAB } from "@/lib/alert-rules";

/** @param {{loading: boolean, failed: boolean, loaded: boolean, rows: object[]}} props.history */
export function AlertHistory({ history, onRetry }) {
  if (!history.loaded || (history.loading && !history.rows.length)) {
    return (
      <ul aria-label="Loading history" className="divide-y divide-by-line-soft">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex gap-3 px-4 py-3.5"><Skeleton className="size-8 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></li>
        ))}
      </ul>
    );
  }
  if (history.failed) {
    return (
      <div className="p-4">
        <Notice tone="danger" action={<Button size="sm" onClick={onRetry}><RefreshCw aria-hidden="true" />Try again</Button>}>Couldn't load the history.</Notice>
      </div>
    );
  }
  if (!history.rows.length) return <EmptyState icon={<BellRing />} title={EMPTY_TAB.history.title}>{EMPTY_TAB.history.body}</EmptyState>;
  return (
    <ul aria-label="Fired alerts" className="divide-y divide-by-line-soft">
      {history.rows.map((r) => (
        <li key={r.key} className="flex items-start gap-3 px-4 py-3">
          <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-by-danger-bg text-by-danger"><BellRing className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-by-body-sm font-semibold">{r.rule ?? "Deleted alert"}</span>
              {r.client && <span className="text-by-caption text-by-text-2">{r.client}</span>}
            </div>
            <p className="mt-0.5 text-by-body-sm text-by-text-2 [overflow-wrap:anywhere]">{r.message}</p>
          </div>
          <span className="shrink-0 text-by-caption text-by-muted">{r.at ? formatRelative(new Date(r.at)) : "—"}</span>
        </li>
      ))}
    </ul>
  );
}
