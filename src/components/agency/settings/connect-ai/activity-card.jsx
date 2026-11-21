"use client";

// Everything the owner's connected AI apps did in Birdy, newest first. Filters
// refetch from the first page; a row opens ActivityPanel beside the log.

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, History } from "lucide-react";
import { Button, Card, Notice, Skeleton, Table, TableBody, TableHead, TableScroll, Td, Th, Tr, buttonVariants, cn } from "@/components/by";
import { API_BASE_URL, apiRequest } from "@/lib/api";
import { KIND_LABEL, activityQuery, formatCredits, formatWhen, kindLabel, plural } from "@/lib/connect-ai";
import { ActivityPanel } from "./activity-panel";
import { AppTile } from "./app-tile";
import { SelectMenu } from "./select-menu";

const PERIODS = [7, 30, 90];
const KIND_DOT = { lookup: "bg-by-line-strong", change: "bg-by-accent", preview: "bg-by-accent", live: "bg-by-warning-solid", refused: "bg-by-danger-solid" };

function Kind({ kind, reason }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className={cn("size-2 rounded-full", KIND_DOT[kind] || KIND_DOT.lookup)} />
      {kindLabel(kind, reason)}
    </span>
  );
}

export function ActivityCard() {
  const [filters, setFilters] = useState({ app: "", kind: "", client: "", days: 7 });
  const [apps, setApps] = useState([]);
  const [clientOptions, setClientOptions] = useState({}); // id -> name, kept as filters narrow the list
  const [items, setItems] = useState(null);
  const [totals, setTotals] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [openId, setOpenId] = useState(null);
  const seq = useRef(0);

  const rememberClients = (list) =>
    setClientOptions((prev) => {
      const next = { ...prev };
      for (const it of list) for (const c of it.clients || []) if (c.id && c.name) next[c.id] = c.name;
      return next;
    });

  useEffect(() => {
    let live = true;
    apiRequest("/api/mcp/activity/apps")
      .then((r) => (r.ok ? r.json() : []))
      .then((a) => {
        if (live && Array.isArray(a)) setApps(a);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const mine = ++seq.current;
    setItems(null);
    setLoadError(false);
    setMoreError(false);
    setCursor(null);
    (async () => {
      try {
        const res = await apiRequest(`/api/mcp/activity?${activityQuery(filters)}`);
        if (!res.ok) throw new Error("load failed");
        const data = await res.json();
        if (mine !== seq.current) return;
        setItems(data.items || []);
        setTotals(data.totals || null);
        setCursor(data.next_cursor || null);
        rememberClients(data.items || []);
      } catch {
        if (mine === seq.current) {
          setLoadError(true);
          setItems([]);
        }
      }
    })();
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    const mine = seq.current;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const q = activityQuery(filters);
      q.set("cursor", cursor);
      const res = await apiRequest(`/api/mcp/activity?${q}`);
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      if (mine !== seq.current) return;
      setItems((prev) => [...(prev || []), ...(data.items || [])]);
      setCursor(data.next_cursor || null);
      rememberClients(data.items || []);
    } catch {
      if (mine === seq.current) setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, filters]);

  const setFilter = (key) => (raw) => {
    const value = key === "days" ? Number(raw) : raw;
    setOpenId(null);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const csvHref = `${API_BASE_URL}/api/mcp/activity.csv?${activityQuery(filters)}`;
  const empty = items !== null && items.length === 0 && !loadError;

  return (
    <Card className="flex min-w-0 flex-col gap-3.5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-by-lg bg-by-sunken text-by-text-2 [&_svg]:size-5"><History /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Activity</h3>
          <p className="text-by-body-sm text-by-muted">
            Everything your AI apps did in Birdy, newest first.
            {totals && <> {plural(totals.requests, "request")} · {formatCredits(totals.credits)} credits</>}
          </p>
        </div>
        <a href={csvHref} download className={buttonVariants({ size: "sm" })}><Download aria-hidden="true" />Export CSV</a>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SelectMenu label="App" value={filters.app} onChange={setFilter("app")} className="max-w-full"
          options={[["", "All apps"], ...apps.map((a) => [a.grant_id, `${a.app_name}${a.revoked ? " (disconnected)" : ""}`])]} />
        <SelectMenu label="Kind" value={filters.kind} onChange={setFilter("kind")} options={[["", "All kinds"], ...Object.entries(KIND_LABEL)]} />
        <SelectMenu label="Client" value={filters.client} onChange={setFilter("client")} className="max-w-full" options={[["", "All clients"], ...Object.entries(clientOptions)]} />
        <SelectMenu label="Period" value={String(filters.days)} onChange={setFilter("days")} options={PERIODS.map((d) => [String(d), `Last ${d} days`])} />
      </div>

      {items === null ? (
        <div aria-busy="true" aria-label="Loading activity" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full rounded-by-md" />)}
        </div>
      ) : empty ? (
        <p className="rounded-by-md border border-dashed border-by-line-strong px-4 py-6 text-center text-by-body-sm text-by-muted">Nothing yet. Requests from your connected apps will show up here.</p>
      ) : items.length > 0 ? (
        <div className={cn("min-w-0 overflow-hidden rounded-by-lg border border-by-line", openId && "md:grid md:grid-cols-[minmax(0,1fr)_340px]")}>
          {/* The log scrolls inside its card; its header row stays put. */}
          <TableScroll className="max-h-[480px] rounded-none border-0 shadow-none">
            <Table>
              <TableHead>
                <tr>
                  <Th className="hidden md:table-cell">When</Th>
                  <Th className="hidden w-px px-1 md:table-cell"><span className="sr-only">App</span></Th>
                  <Th className="px-3 md:px-4">What happened</Th>
                  <Th className="hidden md:table-cell">Kind</Th>
                  <Th numeric className="px-3 md:px-4">Credits</Th>
                </tr>
              </TableHead>
              <TableBody>
                {items.map((it) => (
                  <Tr key={it.id} interactive onClick={() => setOpenId(it.id)} className={openId === it.id ? "bg-by-accent-soft hover:bg-by-accent-soft" : undefined}>
                    <Td className="hidden w-px text-by-text-2 md:table-cell">{formatWhen(it.created_at)}</Td>
                    <Td className="hidden w-px px-1 md:table-cell"><AppTile name={it.app_name} /></Td>
                    <Td className="h-auto min-w-0 whitespace-normal px-3 py-2.5 md:px-4">
                      <button type="button" className="cursor-pointer text-left focus-visible:underline focus-visible:outline-none">{it.summary}</button>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-by-caption text-by-muted md:hidden">
                        <AppTile name={it.app_name} className="size-5 text-[10px]" />
                        <span>{formatWhen(it.created_at)}</span>
                        <Kind kind={it.kind} reason={it.refusal_reason} />
                      </span>
                    </Td>
                    <Td className="hidden text-by-body-sm text-by-text-2 md:table-cell"><Kind kind={it.kind} reason={it.refusal_reason} /></Td>
                    <Td numeric className="w-px px-3 text-by-text-2 md:px-4">{formatCredits(it.credits?.total)}</Td>
                  </Tr>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
          {openId && <ActivityPanel id={openId} onClose={() => setOpenId(null)} onOpen={setOpenId} />}
        </div>
      ) : null}

      {loadError && <Notice tone="danger">Couldn&apos;t load activity. Change a filter or refresh to try again.</Notice>}
      {moreError && <Notice tone="danger">Couldn&apos;t load more. Try Load more again.</Notice>}
      {cursor && (
        <div className="flex justify-center">
          <Button size="sm" loading={loadingMore} onClick={loadMore}>Load more</Button>
        </div>
      )}
    </Card>
  );
}
