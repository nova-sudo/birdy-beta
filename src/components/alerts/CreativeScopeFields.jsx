"use client"

import { Checkbox, Label, Switch } from "@/components/ds"

/** Statuses that count as live for an alert. `posting` is shown but has no numbers yet. */
export const LIVE_TEST_STATUSES = ["posting", "testing", "winner", "loser", "inconclusive"]

/**
 * Creative-test targets for an alert: an "All live tests" toggle and a checklist of live tests.
 * An empty selection means every live test.
 *
 * @param {{ value: string[], onChange: (ids: string[]) => void, tests: object[] }} props
 */
export default function CreativeScopeFields({ value, onChange, tests }) {
  const live = (tests ?? []).filter((t) => LIVE_TEST_STATUSES.includes(t.status))
  const all = value.length === 0
  const liveIds = new Set(live.map((t) => t.id))
  // Saved ids that are no longer live stay listed (checked) so they can be dropped.
  const stale = value.filter((id) => !liveIds.has(id))

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-pd-border px-3 py-2.5">
        <Label htmlFor="alert-all-live-tests" className="text-sm font-medium">All live tests</Label>
        <Switch
          id="alert-all-live-tests"
          aria-label="All live tests"
          checked={all}
          onCheckedChange={(on) => { if (on) onChange([]) }}
          disabled={all && live.length === 0}
        />
      </div>
      {live.length === 0 && stale.length === 0 ? (
        <p className="text-sm text-muted-foreground">No live tests yet. The alert will cover tests as they go live.</p>
      ) : (
        <div className="max-h-[220px] overflow-y-auto rounded-2xl border border-pd-border divide-y divide-pd-divider">
          {live.map((t) => (
            <label key={t.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-pd-table-head transition-colors">
              <Checkbox
                aria-label={`${t.code} ${t.name}`}
                checked={value.includes(t.id)}
                onCheckedChange={() => toggle(t.id)}
              />
              <span className="text-xs font-mono text-muted-foreground">{t.code}</span>
              <span className="text-sm truncate">{t.name}</span>
            </label>
          ))}
          {stale.map((id) => {
            const t = (tests ?? []).find((x) => x.id === id)
            const label = t ? `${t.code} ${t.name}` : id
            return (
              <label key={id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-pd-table-head transition-colors">
                <Checkbox aria-label={`${label} (not live)`} checked onCheckedChange={() => toggle(id)} />
                {t && <span className="text-xs font-mono text-muted-foreground">{t.code}</span>}
                <span className="text-sm truncate">{t ? t.name : id}</span>
                <span className="text-xs text-muted-foreground">(not live)</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
