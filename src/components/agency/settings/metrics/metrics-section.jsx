"use client";

// Settings › Metrics: every metric powering the dashboards and formulas, by
// source; show or hide each, and create, edit, duplicate and delete custom
// formulas. Ask Birdy to make one from the bar under the table.
//
// The tab, search, sort and Hidden filter live in the address
// (/settings?section=metrics&tab=…&q=…), which /metrics redirects to.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Copy, Eye, EyeOff, Pencil, Plus, SearchX, Trash2, Calculator } from "lucide-react";
import {
  Button, Card, Dialog, DialogBody, DialogContent, DialogFooter, EmptyState, Notice, SearchField, Skeleton, TabPill, Table, TableBody, TableHead, TableScroll, Td, Th, Tooltip, Tr, cn,
} from "@/components/by";
import { useAgentChat } from "@/components/agency/chat/use-agent-chat";
import { copyName } from "@/lib/formula-builder";
import { METRIC_TABS, nextSort, tabCounts, viewFromParams, viewToHref, visibleRows } from "@/lib/metrics-catalog";
import { useMetrics } from "./use-metrics";
import { FormulaDialog } from "./formula-dialog";
import { MetricsAskBar, MetricsAskPanel } from "./metrics-ask";
import { SourceMark, SourcePill } from "./source-mark";

const PAGE = 15; // rows per screen; "Load more" adds the next 15
const BLANK = { name: "", description: "", dashboards: [], formulaParts: [], formatType: "integer", aggregation: "total" };
const NO_MATCH = { all: "No metrics", ghl: "No GoHighLevel metrics", meta: "No Meta metrics", sales: "No Sales metrics", birdy: "No Birdy metrics", tag: "No tags", custom: "No custom formulas" };

function IconAction({ label, onClick, danger = false, children }) {
  return (
    <Tooltip label={label}>
      <Button kind="ghost" size="sm" iconOnly aria-label={label} onClick={onClick} className={danger ? "hover:bg-by-danger-bg hover:text-by-danger" : undefined}>{children}</Button>
    </Tooltip>
  );
}

function ConfirmDelete({ metric, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent title={`Delete ${metric.name}?`}>
        <DialogBody>
          <p className="text-by-body text-by-text-2">It comes off every dashboard it shows on. This can’t be undone.</p>
        </DialogBody>
        <DialogFooter className="justify-end">
          <Button onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            kind="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
          >
            Delete formula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MetricsSection() {
  const search = useSearchParams();
  const [view, setView] = useState(() => viewFromParams(search));
  const [pages, setPages] = useState(1);
  const [dialog, setDialog] = useState(null); // { mode, id?, initial }
  const [deleting, setDeleting] = useState(null);
  const [asking, setAsking] = useState(false);
  const metrics = useMetrics();
  const { rows, hidden, customs, base, loading, failed } = metrics;
  const chat = useAgentChat({ sessionKey: "by_settings_metrics", page: "custom_metrics", onSettled: metrics.refreshCustoms });

  const set = (patch) => setView((v) => ({ ...v, ...patch }));
  // Kept in the address without a navigation, so a reload or a shared link opens the same view.
  useEffect(() => {
    const href = viewToHref(view);
    if (href !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, "", href);
  }, [view]);
  useEffect(() => setPages(1), [view]);

  const hiddenHere = rows.filter((r) => (view.tab === "all" || r.source === view.tab) && hidden.has(r.id)).length;
  const hiddenOnly = view.hiddenOnly && hiddenHere > 0;
  const shown = useMemo(() => visibleRows(rows, { ...view, hiddenOnly, hidden }), [rows, view, hiddenOnly, hidden]);
  const counts = useMemo(() => tabCounts(rows, view.query), [rows, view.query]);
  const page = shown.slice(0, pages * PAGE);
  const showSource = view.tab === "all";

  const labelOf = useCallback((id) => base.find((m) => m.id === id)?.label ?? customs.find((c) => c.id === id)?.name, [base, customs]);
  // What a formula can use: base metrics that resolve per client and are not hidden, and the other custom formulas.
  const options = useMemo(() => [
    ...base.filter((m) => m.level !== "account" && !hidden.has(m.id)),
    ...customs.filter((c) => c.id !== dialog?.id || dialog?.mode !== "edit").map((c) => ({ id: c.id, label: c.name, category: "Custom Formula" })),
  ], [base, customs, hidden, dialog]);

  const openNew = () => setDialog({ mode: "new", initial: BLANK });
  const openEdit = (c) => setDialog({ mode: "edit", id: c.id, initial: c });
  const openDup = (c) => setDialog({ mode: "dup", id: c.id, initial: { ...c, name: copyName(c.name, customs.map((m) => m.name)), dashboards: [...c.dashboards], formulaParts: c.formulaParts.map((p) => ({ ...p })) } });
  const saveDialog = async (payload) => {
    const saved = await metrics.save(payload, dialog.mode === "edit" ? dialog.id : undefined);
    if (!saved) return false;
    setView({ tab: "custom", query: "", sort: null, hiddenOnly: false });
    return true;
  };

  const items = METRIC_TABS.map((t) => ({
    value: t.key,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <SourceMark source={t.key} />
        {t.label}
        {!loading && !failed && <span className={cn("tabular-nums", view.query && counts[t.key] === 0 ? "text-by-muted" : "text-by-text-2")}>{counts[t.key].toLocaleString("en-GB")}</span>}
      </span>
    ),
  }));

  // No matches here: point to the tab with the most.
  const elsewhere = view.query && !shown.length
    ? METRIC_TABS.filter((t) => t.key !== "all" && t.key !== view.tab && counts[t.key] > 0).sort((a, b) => counts[b.key] - counts[a.key])[0]
    : null;

  let body;
  if (failed) {
    body = <Notice tone="danger" icon={<AlertCircle aria-hidden="true" />} action={<Button size="sm" onClick={metrics.reload}>Retry</Button>}>Couldn’t load your metrics. Check your connection and try again.</Notice>;
  } else if (!loading && shown.length === 0) {
    body = (
      <Card>
        {view.query ? (
          <EmptyState
            icon={<SearchX />}
            title={`${NO_MATCH[view.tab]} match “${view.query.trim()}”`}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button kind="soft" onClick={() => set({ query: "", hiddenOnly: false })}>Clear search</Button>
                {elsewhere && <Button kind="ghost" onClick={() => set({ tab: elsewhere.key, hiddenOnly: false })}>See {counts[elsewhere.key]} in {elsewhere.label}</Button>}
              </div>
            }
          />
        ) : view.tab === "custom" ? (
          <EmptyState icon={<Calculator />} title="No custom formulas yet" action={<Button kind="primary" onClick={openNew}><Plus aria-hidden="true" />New formula</Button>}>
            Build a metric from the ones you already track, like CPA from ad spend and closes.
          </EmptyState>
        ) : (
          <EmptyState title={`${NO_MATCH[view.tab]} yet`}>Connect the source under Connections and its metrics show up here.</EmptyState>
        )}
      </Card>
    );
  } else {
    body = (
      <TableScroll className="flex-initial">
        <Table className="table-fixed">
          <colgroup>
            <col className="md:w-[30%]" />
            <col className="max-md:hidden" />
            {showSource && <col className="w-36 max-sm:hidden" />}
            <col className="w-28 md:w-32" />
          </colgroup>
          <TableHead>
            <tr>
              <Th sort={view.sort?.key === "name" ? view.sort.dir : null} onSort={() => set({ sort: nextSort(view.sort, "name") })}>Metric name</Th>
              <Th className="max-md:hidden" sort={view.sort?.key === "note" ? view.sort.dir : null} onSort={() => set({ sort: nextSort(view.sort, "note") })}>Notes</Th>
              {showSource && <Th className="max-sm:hidden" sort={view.sort?.key === "source" ? view.sort.dir : null} onSort={() => set({ sort: nextSort(view.sort, "source") })}>Source</Th>}
              <Th className="text-right">{view.tab === "custom" ? "Actions" : "Show / hide"}</Th>
            </tr>
          </TableHead>
          <TableBody>
            {loading
              ? Array.from({ length: 8 }, (_, i) => (
                  <Tr key={i}>
                    <Td><Skeleton className="w-40" /></Td>
                    <Td className="max-md:hidden"><Skeleton className="w-56" /></Td>
                    {showSource && <Td className="max-sm:hidden"><Skeleton className="w-20" /></Td>}
                    <Td><Skeleton className="ml-auto w-8" /></Td>
                  </Tr>
                ))
              : page.map((r) => {
                  const off = hidden.has(r.id);
                  return (
                    <Tr key={r.id} data-row={r.id}>
                      <Td className="whitespace-normal py-2.5">
                        <div className={cn("flex min-w-0 items-center gap-2 font-semibold", off && "text-by-muted")}>
                          <span className={cn("truncate", off && "line-through")} title={r.name}>{r.name}</span>
                          {off && <span className="shrink-0 text-by-caption font-medium">Hidden</span>}
                        </div>
                        {r.custom?.formula && <div className="truncate text-by-caption text-by-muted" title={r.custom.formula}>{r.custom.formula}</div>}
                        {r.note && <div className="truncate text-by-caption text-by-text-2 md:hidden">{r.note}</div>}
                      </Td>
                      <Td className="truncate text-by-body-sm text-by-text-2 max-md:hidden" title={r.note || undefined}>{r.note || <span className="text-by-muted">–</span>}</Td>
                      {showSource && <Td className="max-sm:hidden"><SourcePill source={r.source} /></Td>}
                      <Td className="text-right">
                        {r.custom ? (
                          <span className="inline-flex gap-0.5">
                            <IconAction label={`Edit ${r.name}`} onClick={() => openEdit(r.custom)}><Pencil aria-hidden="true" /></IconAction>
                            <IconAction label={`Duplicate ${r.name}`} onClick={() => openDup(r.custom)}><Copy aria-hidden="true" /></IconAction>
                            <IconAction label={`Delete ${r.name}`} danger onClick={() => setDeleting(r.custom)}><Trash2 aria-hidden="true" /></IconAction>
                          </span>
                        ) : (
                          <Tooltip label={off ? "Hidden. Click to show it in the formula builder" : "Showing. Click to hide it from the formula builder"}>
                            <Button kind="ghost" size="sm" iconOnly aria-pressed={!off} aria-label={`${off ? "Show" : "Hide"} ${r.name}`} onClick={() => metrics.toggleHidden(r)}>
                              {off ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                            </Button>
                          </Tooltip>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
          </TableBody>
        </Table>
        {!loading && shown.length > page.length && (
          <button type="button" onClick={() => setPages((n) => n + 1)} className="block w-full cursor-pointer border-t border-by-line-soft py-3 text-center text-by-body-sm font-semibold text-by-accent tabular-nums hover:bg-by-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-by-accent">
            Load more · {(shown.length - page.length).toLocaleString("en-GB")} left of {shown.length.toLocaleString("en-GB")}
          </button>
        )}
      </TableScroll>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2.5">
          <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabPill items={items} value={view.tab} onValueChange={(tab) => set({ tab, sort: tab === "all" || view.sort?.key !== "source" ? view.sort : null })} aria-label="Metrics by source" />
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto">
            {hiddenHere > 0 && (
              <Button size="sm" kind={hiddenOnly ? "soft" : "secondary"} aria-pressed={hiddenOnly} onClick={() => set({ hiddenOnly: !hiddenOnly })}>
                <EyeOff aria-hidden="true" />Hidden <span className="tabular-nums">{hiddenHere}</span>
              </Button>
            )}
            <SearchField className="order-first basis-full lg:order-none lg:w-56 lg:basis-auto" placeholder="Search metrics" aria-label="Search metric names, notes and sources" value={view.query} onChange={(e) => set({ query: e.target.value })} />
            <Button onClick={openNew}><Plus aria-hidden="true" />New formula</Button>
          </div>
        </div>
        {body}
        <span className="min-h-0 flex-1" aria-hidden="true" />
        <MetricsAskBar chat={chat} onOpenChange={setAsking} />
      </div>
      {asking && <MetricsAskPanel chat={chat} onOpenChange={setAsking} />}

      {dialog && (
        <FormulaDialog
          key={`${dialog.mode}-${dialog.id ?? "new"}`}
          mode={dialog.mode}
          initial={dialog.initial}
          options={options}
          customs={customs}
          editingId={dialog.mode === "edit" ? dialog.id : undefined}
          labelOf={labelOf}
          onSave={saveDialog}
          onClose={() => setDialog(null)}
        />
      )}
      {deleting && (
        <ConfirmDelete
          metric={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            if (await metrics.remove(deleting)) setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
