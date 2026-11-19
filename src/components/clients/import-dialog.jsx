"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Button, Checkbox, Dialog, DialogBody, DialogContent, DialogFooter, DropdownTrigger, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger,
  Notice, Pill, SearchField, Switch, Table, TableBody, TableHead, Td, Th, Tr,
} from "@/components/by";
import { apiRequest } from "@/lib/api";
import { MAX_IMPORT_SELECTION, autoCheckedIds, importPayload, listedAccounts, orderRows, resolveRows, rowMatches } from "@/lib/import-review";
import { LEAD_SOURCE_OPTIONS, LEAD_SOURCE_UNKNOWN } from "@/lib/lead-sources";

const POLL_MS = 2500;
const LEAD_SOURCES = [{ ...LEAD_SOURCE_UNKNOWN, short: "Ask later" }, ...LEAD_SOURCE_OPTIONS];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Starts the server's read of the agency's sub-accounts and polls until it
 * settles. A failed poll keeps the last good answer rather than blanking a
 * table someone may be working through.
 */
function useReview(open) {
  const [review, setReview] = useState(null);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let timer;
    setReview(null);
    setSettled(false);
    const poll = async () => {
      try {
        const res = await apiRequest("/api/onboarding/subaccounts-review");
        if (cancelled) return;
        if (!res.ok) throw new Error("review");
        const data = await res.json();
        if (cancelled) return;
        setReview(data);
        if (data?.prep?.status !== "running") {
          setSettled(true);
          return;
        }
      } catch {
        if (cancelled) return;
      }
      timer = setTimeout(poll, POLL_MS);
    };
    apiRequest("/api/onboarding/prepare-review", { method: "POST" }).catch(() => {}).finally(poll);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open]);
  return { review, settled };
}

function Stat({ value, label }) {
  return (
    <div className="flex-1 rounded-by-md border border-by-line bg-by-surface px-3 py-2">
      <div className="font-by-display text-by-heading font-semibold tabular-nums">{value}</div>
      <div className="text-by-caption text-by-muted">{label}</div>
    </div>
  );
}

/** A compact field-shaped button that opens a menu of choices for one cell. */
function CellMenu({ label, tone, children, ...props }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <DropdownTrigger
          className={`h-8 w-full px-2.5 ${tone === "warning" ? "border-by-warning-solid bg-by-warning-bg text-by-warning" : tone === "muted" ? "text-by-muted" : ""}`}
          {...props}
        >
          {label}
        </DropdownTrigger>
      </MenuTrigger>
      <MenuContent className="max-h-72 overflow-y-auto">{children}</MenuContent>
    </Menu>
  );
}

/**
 * Import several GoHighLevel sub-accounts as clients at once.
 *
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {() => void} [props.onImported] called after an import that added clients
 */
export function ImportDialog({ open, onOpenChange, onImported }) {
  const { review, settled } = useReview(open);
  const [edits, setEdits] = useState({});
  const [search, setSearch] = useState("");
  const [hideInactive, setHideInactive] = useState(true);
  const [importing, setImporting] = useState(false);
  const [failure, setFailure] = useState(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setEdits({});
      setSearch("");
      setHideInactive(true);
      setFailure(null);
    }
    wasOpen.current = open;
  }, [open]);

  const { unimported, accounts, hasRecency } = useMemo(() => listedAccounts(review), [review]);
  const autoChecked = useMemo(() => autoCheckedIds(accounts), [accounts]);
  const resolved = resolveRows(accounts, edits, autoChecked);
  const ordered = orderRows(resolved);
  const query = search.trim().toLowerCase();
  // Filtering and hiding are view concerns only: a ticked row is never hidden
  // by "hide inactive", and what gets imported is read from every row.
  const visible = ordered.filter((row) => rowMatches(row, query) && (!hideInactive || row.status !== "inactive" || row.importChecked));
  const hiddenChecked = resolved.filter((row) => row.importChecked && !visible.includes(row)).length;
  const hiddenInactive = hideInactive ? ordered.filter((row) => rowMatches(row, query) && row.status === "inactive" && !row.importChecked).length : 0;
  const selected = resolved.filter((row) => row.importChecked);
  const atCap = selected.length >= MAX_IMPORT_SELECTION;
  const withoutAds = selected.filter((row) => !row.fb).length;
  const activeCount = resolved.filter((row) => row.status === "active").length;
  const fbAccounts = review?.fb_accounts || [];
  const patch = (id, changes) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }));

  const runImport = async () => {
    const payload = importPayload(resolved);
    if (!payload.length) return;
    setImporting(true);
    setFailure(null);
    try {
      const res = await apiRequest("/api/onboarding/import-subaccounts", { method: "POST", body: JSON.stringify({ accounts: payload }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFailure(data?.detail || "The import didn’t go through. Nothing was added.");
        return;
      }
      const added = data?.imported?.length ?? 0;
      const overLimit = data?.skipped_limit?.length ?? 0;
      const already = data?.skipped_existing?.length ?? 0;
      if (added) toast.success(`Importing ${plural(added, "client")}. Their data is syncing now.`);
      // Say what was left out and why: a silent partial import looks like a bug.
      if (overLimit) toast.warning(`${plural(overLimit, "client")} skipped: your plan’s client limit is full.`);
      if (already && !added) toast.info("Those clients are already in Birdy.");
      // Imported without Meta because another client already uses that ad account.
      const nameOf = Object.fromEntries(payload.map((a) => [a.location_id, a.name]));
      const unlinked = (data?.imported || []).filter((r) => r?.meta_skipped_reason).map((r) => nameOf[r.location_id] || "A client");
      if (unlinked.length) toast.warning(`Meta wasn’t linked for ${unlinked.join(", ")}: that ad account is already used by another client. Add them again from Add client to choose their campaigns.`);
      onOpenChange(false);
      if (added) onImported?.();
    } catch {
      setFailure("Couldn’t reach Birdy. Check your connection and try again; nothing was added.");
    } finally {
      setImporting(false);
    }
  };

  const reading = review === null || !settled;
  const prep = review?.prep;

  return (
    <Dialog open={open} onOpenChange={(o) => !importing && onOpenChange(o)}>
      <DialogContent
        size="xl"
        title="Import clients from GoHighLevel"
        description={reading ? "Reading your sub-accounts and matching them to your Meta ad accounts." : hasRecency ? "We ticked the sub-accounts with a lead in the last 7 days. Check the names and ad accounts, then import." : "These are the sub-accounts you haven’t imported yet. Check the names and ad accounts, then import."}
      >
        <DialogBody className="min-h-[26rem]">
          {reading ? (
            <div role="status" className="mx-auto flex max-w-sm flex-col items-center gap-3 py-20 text-center">
              <div className="font-by-display text-by-heading font-semibold">Analysing your sub-accounts</div>
              <p className="text-by-body-sm text-by-text-2">
                {prep?.total ? `${prep.done ?? 0} of ${prep.total} sub-accounts checked` : "Finding which ones are still bringing in leads. This can take a minute."}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-by-sunken">
                <div className="h-full rounded-full bg-by-accent transition-[width] duration-(--by-dur-base) ease-by-out" style={{ width: `${prep?.total ? Math.round(((prep.done ?? 0) / prep.total) * 100) : 8}%` }} />
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <Notice className="mt-2">Every sub-account is already in Birdy. There’s nothing left to import.</Notice>
          ) : (
            <>
              {failure && <Notice tone="danger" className="mb-3">{failure}</Notice>}
              <div className="flex gap-2.5">
                <Stat value={unimported.length} label="Sub-accounts found" />
                <Stat value={hasRecency ? unimported.filter((a) => a.leads_recent_90 === true).length : "—"} label="With leads in 90 days" />
                <Stat value={activeCount} label="Active" />
                <Stat value={resolved.length - activeCount} label="Inactive" />
              </div>
              <div className="my-3 flex items-center gap-3">
                <SearchField className="flex-1" placeholder={`Search ${plural(resolved.length, "sub-account")} or ad accounts`} value={search} onChange={(e) => setSearch(e.target.value)} />
                <Switch label="Hide inactive" checked={hideInactive} onCheckedChange={setHideInactive} />
              </div>
              <div className="overflow-hidden rounded-by-lg border border-by-line">
                <Table className="table-fixed">
                  <colgroup><col className="w-10" /><col className="w-[23%]" /><col className="w-[20%]" /><col /><col className="w-44" /><col className="w-28" /></colgroup>
                  <TableHead>
                    <tr><Th><span className="sr-only">Import</span></Th><Th>Name in Birdy</Th><Th>GoHighLevel sub-account</Th><Th>Meta ad account</Th><Th>Leads from</Th><Th>Status</Th></tr>
                  </TableHead>
                  <TableBody>
                    {visible.map((row) => {
                      const id = row.location_id;
                      const source = LEAD_SOURCES.find((o) => o.key === row.leadSource) ?? LEAD_SOURCES[0];
                      return (
                        <Tr key={id} className={row.status === "inactive" ? "text-by-muted" : undefined}>
                          <Td className="px-2.5">
                            <Checkbox
                              aria-label={`Import ${row.name}`}
                              checked={row.importChecked}
                              // At the cap, unticking is always allowed; ticking another is not.
                              disabled={atCap && !row.importChecked}
                              onCheckedChange={(checked) => patch(id, { import: checked === true })}
                            />
                          </Td>
                          <Td className="px-2.5">
                            <input
                              aria-label={`Name in Birdy for ${row.name}`}
                              value={row.birdyName}
                              onChange={(e) => patch(id, { birdyName: e.target.value })}
                              className="h-8 w-full truncate rounded-by-md border border-transparent bg-transparent px-2 font-semibold caret-by-accent outline-none hover:border-by-line focus:border-by-accent focus:outline-2 focus:-outline-offset-1 focus:outline-by-accent"
                            />
                          </Td>
                          <Td className="truncate px-2.5 text-by-body-sm text-by-text-2" title={row.name}>{row.name}</Td>
                          <Td className="px-2.5">
                            <CellMenu aria-label={`Meta ad account for ${row.name}`} label={row.fb?.name ?? "No matching ad account"} tone={row.fb ? undefined : "warning"}>
                              {row.suggestion && !row.fb && (
                                <>
                                  <MenuItem onSelect={() => patch(id, { fb: row.suggestion })}>Did you mean {row.suggestion.name}?</MenuItem>
                                  <MenuSeparator />
                                </>
                              )}
                              <MenuItem selected={!row.fb} onSelect={() => patch(id, { fb: null })}>No ad account</MenuItem>
                              {fbAccounts.map((a) => (
                                <MenuItem key={a.id} selected={row.fb?.id === a.id} onSelect={() => patch(id, { fb: a })}>{a.name || a.id}</MenuItem>
                              ))}
                            </CellMenu>
                          </Td>
                          <Td className="px-2.5">
                            <CellMenu aria-label={`Leads come from, for ${row.name}`} label={source.short} tone={row.leadSource === "unknown" ? "muted" : undefined}>
                              {LEAD_SOURCES.map((o) => (
                                <MenuItem key={o.key} selected={row.leadSource === o.key} onSelect={() => patch(id, { leadSource: o.key })}>{o.label}</MenuItem>
                              ))}
                            </CellMenu>
                          </Td>
                          <Td className="px-2.5">
                            <Menu>
                              <MenuTrigger aria-label={`Status of ${row.name}`} className="cursor-pointer rounded-by-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">
                                <Pill tone={row.status === "active" ? "success" : "neutral"}>{row.status === "active" ? "Active" : "Inactive"}</Pill>
                              </MenuTrigger>
                              <MenuContent>
                                <MenuItem selected={row.status === "active"} onSelect={() => patch(id, { status: "active" })}>Active</MenuItem>
                                <MenuItem selected={row.status === "inactive"} onSelect={() => patch(id, { status: "inactive" })}>Inactive</MenuItem>
                              </MenuContent>
                            </Menu>
                          </Td>
                        </Tr>
                      );
                    })}
                  </TableBody>
                </Table>
                {visible.length === 0 && <p className="px-4 py-6 text-center text-by-body-sm text-by-text-2">No sub-account or ad account matches “{search.trim()}”.</p>}
              </div>
              <p className="mt-2 text-by-caption text-by-muted" aria-live="polite">
                {plural(selected.length, "sub-account")} selected, up to {MAX_IMPORT_SELECTION} at once
                {hiddenChecked > 0 && ` · ${plural(hiddenChecked, "selected row")} hidden by this search`}
                {hiddenInactive > 0 && ` · ${hiddenInactive} inactive hidden`}
                {atCap && " · untick one to pick another"}
              </p>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <span className="min-w-0 flex-1 text-by-body-sm text-by-text-2">
            {!reading && withoutAds > 0 && `${plural(withoutAds, "selected sub-account")} ${withoutAds === 1 ? "has" : "have"} no ad account and will import without ad data.`}
          </span>
          <Button disabled={importing} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button kind="primary" disabled={reading || selected.length === 0} loading={importing} onClick={runImport}>
            Import {plural(selected.length, "client")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
