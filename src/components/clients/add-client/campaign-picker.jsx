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

  if (error) return <Notice tone="danger" action={<Button size="sm" onClick={load}>Retry</Button>}>{error}</Notice>;
  if (loading) {
    return (
      <div role="status" aria-label="Loading campaigns" className="flex flex-col gap-1.5">
        {[62, 48, 70].map((w) => (
          <div key={w} className="rounded-by-md border border-by-line px-3 py-3.5"><Skeleton style={{ width: `${w}%` }} /></div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <SearchField placeholder="Search campaigns by name or ID" value={query} onChange={(e) => setQuery(e.target.value)} />
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
      {visible.length === 0 && <p className="px-1 py-2 text-by-body-sm text-by-muted">{q ? `No campaign matches “${query.trim()}”.` : "This ad account has no campaigns."}</p>}
    </div>
  );
}
