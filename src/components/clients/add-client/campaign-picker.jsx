"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Notice, OptionCard, Pill, SearchField, Skeleton } from "@/components/by";
import { apiRequest } from "@/lib/api";

const STATUS = { ACTIVE: ["Active", "success"], PAUSED: ["Paused", "warning"], ARCHIVED: ["Archived", "neutral"], DELETED: ["Deleted", "neutral"] };

function statusOf(status) {
  if (!status) return ["Unknown", "neutral"];
  if (STATUS[status]) return STATUS[status];
  const text = status.replace(/_/g, " ").toLowerCase();
  return [text.charAt(0).toUpperCase() + text.slice(1), "neutral"];
}

/**
 * The campaigns of one Meta ad account, for sharing that account between clients.
 *
 * @param {string} props.adAccountId
 * @param {string[]|null} props.value null means every campaign; an array means only those ids
 * @param {(value: string[]|null) => void} props.onChange
 * @param {boolean} [props.required] no "All campaigns" choice: another client already uses this account
 */
export function CampaignPicker({ adAccountId, value, onChange, required = false }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  // Only the newest request may write state (account switch, Retry, unmount).
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const current = () => id === requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/facebook/adaccounts/${adAccountId}/campaigns`);
      const body = await res.json().catch(() => ({}));
      if (!current()) return;
      if (!res.ok) throw new Error(body?.detail || "Could not load campaigns from Meta.");
      setCampaigns(body.campaigns || []);
    } catch (e) {
      if (current()) setError(e?.message || "Could not load campaigns from Meta.");
    } finally {
      if (current()) setLoading(false);
    }
  }, [adAccountId]);

  useEffect(() => {
    setCampaigns([]);
    setQuery("");
    load();
    return () => {
      requestId.current++;
    };
  }, [load]);

  const selected = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const q = query.trim().toLowerCase();
  const visible = q ? campaigns.filter((c) => c.name?.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) : campaigns;
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  // A notice on its own, in place of the list: the page says plainly what that means for this client.
  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <Notice tone="danger" action={<Button size="sm" onClick={load}>Retry</Button>}>{error}</Notice>
        <p className="px-1 text-by-body-sm text-by-text-2">
          {required
            ? "Campaigns must load before you continue, because another client uses this ad account."
            : "You can still continue. This client will use every campaign in the account, and you can narrow it later from the client’s page."}
        </p>
      </div>
    );
  }
  if (loading) {
    return (
      <div role="status" aria-label="Loading campaigns" className="flex flex-col gap-1.5">
        {[62, 48, 70].map((w) => (
          <div key={w} className="rounded-by-md border border-by-line px-3 py-3.5"><Skeleton style={{ width: `${w}%` }} /></div>
        ))}
      </div>
    );
  }

  const free = campaigns.filter((c) => !c.claimed_by);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      {campaigns.length > 0 && <SearchField className="shrink-0" placeholder="Search campaigns by name or ID" value={query} onChange={(e) => setQuery(e.target.value)} />}
      {required && free.length === 0 && (
        <Notice tone="warning" className="shrink-0">
          {campaigns.length === 0
            ? "This ad account has no campaigns yet, so there is nothing to pick for this client. Pick a different ad account, or add campaigns in Meta first."
            : "Every campaign in this ad account already belongs to another client. Pick a different ad account, or add a campaign in Meta first."}
        </Notice>
      )}
      {/* Only the list scrolls; the search above and the dialog's buttons stay put. */}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 py-0.5" role="group" aria-label="Campaigns">
        {!required && (
          <OptionCard role="checkbox" selected={value === null} onSelect={() => onChange(null)} title="All campaigns" subtitle="Every campaign in this ad account, including new ones" />
        )}
        {visible.map((c) => {
          // A campaign another client already owns is shown but cannot be taken.
          const taken = Boolean(c.claimed_by);
          const [label, tone] = statusOf(c.effective_status);
          return (
            <OptionCard
              key={c.id}
              role="checkbox"
              selected={!taken && selected.includes(c.id)}
              disabled={taken}
              onSelect={() => toggle(c.id)}
              title={c.name || "Unnamed campaign"}
              subtitle={taken ? `Used by ${c.claimed_by.name}` : `ID: ${c.id}`}
              aside={<Pill tone={tone} dot={false}>{label}</Pill>}
            />
          );
        })}
        {visible.length === 0 && q && <p className="px-1 py-2 text-by-body-sm text-by-muted">No campaign matches “{query.trim()}”.</p>}
        {campaigns.length === 0 && !required && <p className="px-1 py-2 text-by-body-sm text-by-muted">This ad account has no campaigns yet. With all campaigns, new ones count for this client as they start.</p>}
      </div>
    </div>
  );
}
