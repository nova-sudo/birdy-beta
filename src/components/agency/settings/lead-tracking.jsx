"use client";

// Settings › Connections: "Lead tracking per client", folded under the
// connection cards. Opened, it says how many clients have a lead source picked
// and lists every client: where its leads come from, whether the pixel is live
// where one is needed, and links to copy the install link or open its setup.
//
// Onboarding imports sub-accounts in bulk, so an agency can finish the wizard
// with many clients at once; this is the one place to see which are live.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button, Disclosure, Notice, Pill, Skeleton, Table, TableBody, TableHead, TableScroll, Td, Th, Tr } from "@/components/by";
import { apiRequest } from "@/lib/api";
import { installLink, trackingRow, trackingSetupHref, trackingSummary } from "@/lib/lead-tracking";

const SOURCE_TONE = { instant_form: "accent", form_to_ghl: "accent", landing_page: "success", unknown: "neutral" };

function Meter({ value, max }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <span aria-hidden="true" className="block h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-by-sunken">
      <span className="block h-full rounded-full bg-by-accent" style={{ width: `${pct}%` }} />
    </span>
  );
}

function Script({ state }) {
  if (state === "live") return <span className="font-medium text-by-success">Live</span>;
  if (state === "not_seen") return <span className="text-by-muted">Not seen</span>;
  return <span className="text-by-muted">—</span>;
}

export function LeadTracking() {
  const router = useRouter();
  const [clients, setClients] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("/attribution/overview");
      if (!res.ok) throw new Error(`Couldn't load tracking status (${res.status})`);
      const data = await res.json();
      setClients(data.clients || []);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyInstallLink = async (row) => {
    try {
      await navigator.clipboard.writeText(installLink(window.location.origin, row.siteId));
      toast.success("Install link copied");
    } catch {
      toast.error("Couldn't copy — open the client's setup to get the link");
    }
  };

  const summary = clients ? trackingSummary(clients) : null;
  const rows = clients ? clients.map((c) => trackingRow(c)) : [];

  const count = error || !summary ? null : summary.unset > 0 ? `${summary.unset} need setup` : summary.total > 0 ? "All set up" : null;

  return (
    <Disclosure label="Lead tracking per client" count={count}>
        <div className="flex flex-col gap-3">
          {error ? (
            <Notice tone="danger" action={<Button size="sm" onClick={load}>Try again</Button>}>{error}</Notice>
          ) : !clients ? (
            <div aria-busy="true" aria-label="Loading tracking status" className="flex flex-col gap-2.5">
              <Skeleton className="w-80 max-w-full" />
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full rounded-by-md" />)}
            </div>
          ) : clients.length === 0 ? (
            <p className="text-by-body-sm text-by-muted">No clients yet.</p>
          ) : (
            <>
              <p className="max-w-[720px] text-by-body-sm text-by-text-2">
                Where each client&apos;s leads come from, and whether the tracking behind it is live.
                {summary.unset > 0 && (
                  <>
                    {" "}
                    <span className="font-semibold text-by-text">
                      {summary.unset} {summary.unset === 1 ? "client has" : "clients have"} no lead source set
                    </span>{" "}
                    — until one is chosen we can&apos;t tell a quiet month from a missing setup.
                  </>
                )}
              </p>
              <div className="flex items-center gap-3">
                <Meter value={summary.set} max={summary.total} />
                <span className="text-by-body-sm text-by-muted tabular-nums">{summary.set} of {summary.total} set up</span>
              </div>
              {/* The table scrolls inside its card; its header row stays put. */}
              <TableScroll className="max-h-[420px] shadow-none">
                <Table className="min-w-[680px]">
                  <TableHead>
                    <tr>
                      <Th>Client</Th>
                      <Th>Leads from</Th>
                      <Th>Script</Th>
                      <Th>Last hit</Th>
                      <Th numeric>Captured</Th>
                      <Th><span className="sr-only">Actions</span></Th>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <Tr key={row.id}>
                        <Td className="max-w-64 truncate font-semibold" title={row.name}>{row.name}</Td>
                        <Td><Pill tone={SOURCE_TONE[row.method]} dot={false}>{row.source}</Pill></Td>
                        <Td><Script state={row.script} /></Td>
                        <Td className={row.lastHit ? "text-by-text-2" : "text-by-muted"}>{row.lastHit || "—"}</Td>
                        <Td numeric className={row.needsScript ? undefined : "text-by-muted"}>{row.needsScript ? row.captured : "—"}</Td>
                        <Td>
                          <div className="flex items-center justify-end gap-1">
                            {row.siteId && row.needsScript && (
                              <Button kind="ghost" size="sm" title="Copy the link to send to whoever owns the site" onClick={() => copyInstallLink(row)}>
                                <Copy aria-hidden="true" />Link
                              </Button>
                            )}
                            <Button kind="ghost" size="sm" className="text-by-accent hover:text-by-accent" onClick={() => router.push(trackingSetupHref(row.id))} aria-label={`Set up tracking for ${row.name}`}>
                              Set up<ExternalLink aria-hidden="true" />
                            </Button>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TableBody>
                </Table>
              </TableScroll>
            </>
          )}
        </div>
    </Disclosure>
  );
}
