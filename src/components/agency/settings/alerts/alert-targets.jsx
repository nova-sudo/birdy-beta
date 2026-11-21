"use client";

// Who an alert watches: a searchable checklist of active clients, or the live
// creative tests (an empty choice means every live test, now and later).

import { useState } from "react";
import { Checkbox, SearchField, Switch } from "@/components/by";
import { toggleId } from "@/lib/alert-rules";

/** Statuses that count as live for an alert. `posting` is listed but has no numbers yet. */
export const LIVE_TEST_STATUSES = ["posting", "testing", "winner", "loser", "inconclusive"];

const LIST = "max-h-56 divide-y divide-by-line-soft overflow-y-auto overscroll-contain rounded-by-md border border-by-line";
const ROW = "flex min-h-10 items-center gap-3 px-3 py-2";

/**
 * @param {{id: string, name: string}[]} props.clients active clients only
 * @param {string[]} props.value chosen client ids
 * @param {(ids: string[]) => void} props.onChange
 */
export function ClientTargets({ clients, value, onChange }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = clients.filter((g) => (g.name || "").toLowerCase().includes(q));
  const all = clients.length > 0 && clients.every((g) => value.includes(g.id));
  return (
    <div className="flex flex-col gap-2">
      <SearchField placeholder="Search clients" aria-label="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className={LIST}>
        <div className={`${ROW} bg-by-canvas`}>
          <Checkbox label={`All active clients (${clients.length})`} checked={all} disabled={!clients.length} onCheckedChange={(on) => onChange(on ? clients.map((g) => g.id) : [])} />
        </div>
        {clients.length === 0 && <p className="px-3 py-3 text-by-body-sm text-by-muted">No active clients yet.</p>}
        {clients.length > 0 && shown.length === 0 && <p className="px-3 py-3 text-by-body-sm text-by-muted">No client matches “{query.trim()}”.</p>}
        {shown.map((g) => (
          <div key={g.id} className={ROW}>
            <Checkbox label={g.name} checked={value.includes(g.id)} onCheckedChange={() => onChange(toggleId(value, g.id))} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {object[]} props.tests creative tests from useCreativeTests
 * @param {string[]} props.value chosen test ids; empty means every live test
 * @param {(ids: string[]) => void} props.onChange
 */
export function TestTargets({ tests, value, onChange }) {
  const live = (tests ?? []).filter((t) => LIVE_TEST_STATUSES.includes(t.status));
  const liveIds = new Set(live.map((t) => t.id));
  // A saved test that is no longer live stays listed, ticked, so it can be dropped.
  const stale = value.filter((id) => !liveIds.has(id));
  const all = value.length === 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-10 items-center justify-between gap-4 rounded-by-md border border-by-line px-3 py-2">
        <Switch label="All live tests" checked={all} disabled={all && live.length === 0} onCheckedChange={(on) => on && onChange([])} />
      </div>
      {live.length === 0 && stale.length === 0 ? (
        <p className="text-by-body-sm text-by-muted">No live tests yet. The alert covers tests as they go live.</p>
      ) : (
        <div className={LIST}>
          {live.map((t) => (
            <div key={t.id} className={ROW}>
              <Checkbox aria-label={`${t.code} ${t.name}`} checked={value.includes(t.id)} onCheckedChange={() => onChange(toggleId(value, t.id))} />
              <span className="font-mono text-by-caption text-by-muted">{t.code}</span>
              <span className="min-w-0 truncate text-by-body-sm">{t.name}</span>
            </div>
          ))}
          {stale.map((id) => {
            const t = (tests ?? []).find((x) => x.id === id);
            return (
              <div key={id} className={ROW}>
                <Checkbox aria-label={`${t ? `${t.code} ${t.name}` : id} (not live)`} checked onCheckedChange={() => onChange(toggleId(value, id))} />
                {t && <span className="font-mono text-by-caption text-by-muted">{t.code}</span>}
                <span className="min-w-0 truncate text-by-body-sm">{t ? t.name : id}</span>
                <span className="text-by-caption text-by-muted">(not live)</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
