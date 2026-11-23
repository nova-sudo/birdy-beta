"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button, Checkbox, ClientTile, Notice, TextField } from "@/components/by";
import { useClientActions } from "@/components/shell/client-actions";
import { apiRequest } from "@/lib/api";
import { buildTargetsPayload, hasAnyTarget } from "@/lib/setup-steps";
import { Bubble, Reply, Say } from "./chat-parts";

const loading = (g) => g.status === "creating" || g.status === "pending";

/** The first client: added with the app's Add client dialog (GoHighLevel sub-account, Meta ad account, calls). */
export function ClientStep({ ctx }) {
  const { facts, steps, agentName } = ctx;
  const { openAddClient } = useClientActions();
  const clients = facts.clients || [];
  const done = steps.client !== "todo";
  return (
    <Bubble name={agentName} id="step-client">
      <Say>Now your first client. Link its GoHighLevel sub-account and Meta ad account, and I’ll start loading its numbers.</Say>
      {!done ? (
        <div><Button kind="primary" onClick={openAddClient}><Plus aria-hidden="true" />Add your first client</Button></div>
      ) : (
        <ClientList clients={clients} />
      )}
    </Bubble>
  );
}

/** The clients so far, each with whether its data is still loading. */
export function ClientList({ clients, max = 6 }) {
  const shown = [...clients].sort((a, b) => (a.name || "").localeCompare(b.name || "")).slice(0, max);
  const still = clients.filter(loading).length;
  return (
    <div className="max-w-xl rounded-by-lg border border-by-line bg-by-surface shadow-by-card">
      <ul>
        {shown.map((g) => (
          <li key={g.id} className="flex items-center gap-3 border-t border-by-line-soft px-3.5 py-2.5 first:border-t-0">
            <ClientTile name={g.name || "?"} size={24} />
            <span className="min-w-0 flex-1 truncate text-by-body">{g.name}</span>
            {loading(g) ? (
              <span className="inline-flex items-center gap-1.5 text-by-caption font-semibold text-by-accent"><Loader2 aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />Loading its numbers…</span>
            ) : (
              <span className="text-by-caption font-semibold text-by-success">Ready</span>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-by-line-soft px-3.5 py-2 text-by-caption text-by-muted">
        {clients.length > max ? `${clients.length} clients in Birdy` : clients.length === 1 ? "1 client in Birdy" : `${clients.length} clients in Birdy`}
        {still ? ` · ${still} still loading` : ""}
      </p>
    </div>
  );
}

const pct = (v) => `${Math.round(Number(v) * 1000) / 10}%`;

/** What the first client's targets say, for the answer bubble. */
function targetsLine(t, sym) {
  return [
    t.cpa != null && `${sym}${t.cpa} per acquisition`,
    t.cpl != null && `${sym}${t.cpl} per lead`,
    t.monthly_wins != null && `${t.monthly_wins} closes a month`,
    t.conversion_rate != null && `${pct(t.conversion_rate)} close rate`,
  ].filter(Boolean).join(" · ") || "Targets set";
}

/** Monthly targets for the first client; optionally the default for every client. */
export function TargetsStep({ ctx }) {
  const { facts, steps, agentName, firstClient, sym, refresh } = ctx;
  const [cpa, setCpa] = useState("");
  const [wins, setWins] = useState("");
  const [rate, setRate] = useState("");
  const [everyone, setEveryone] = useState(true);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);
  const done = steps.targets === "done";
  const withTargets = (facts.clients || []).find((g) => hasAnyTarget(g.targets));
  const payload = buildTargetsPayload({ cpa, wins, convRate: rate, saveAsDefault: everyone });
  const name = firstClient?.name || "your first client";

  const put = (id, body) => apiRequest(`/api/client-groups/${id}/targets`, { method: "PUT", body: JSON.stringify(body) });

  const save = async (e) => {
    e.preventDefault();
    if (!payload || !firstClient) return;
    setSaving(true);
    setProblem(null);
    try {
      const res = await put(firstClient.id, payload);
      if (!res.ok) throw new Error("Those targets weren’t saved. Check the numbers and try again.");
      // "Every client" means every one that has none yet: a target someone already set is left alone.
      if (everyone) {
        const others = (facts.clients || []).filter((g) => g.id !== firstClient.id && !hasAnyTarget(g.targets));
        await Promise.all(others.map((g) => put(g.id, { ...payload, save_as_default: false }).catch(() => null)));
      }
      refresh("clients");
    } catch (err) {
      setProblem(err.message || "Those targets weren’t saved.");
    } finally {
      setSaving(false);
    }
  };

  const digits = (set) => (e) => set(e.target.value.replace(/[^\d.]/g, ""));
  return (
    <>
      <Bubble name={agentName} id="step-targets">
        <Say>Now your targets. What should {name} aim for each month? I flag it when it drifts.</Say>
        {!done && (
          <form onSubmit={save} className="flex max-w-xl flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField label="Cost per acquisition" inputMode="decimal" placeholder="45" value={cpa} onChange={digits(setCpa)} leading={<span aria-hidden="true" className="text-by-muted">{sym}</span>} />
              <TextField label="Closes a month" inputMode="numeric" placeholder="20" value={wins} onChange={digits(setWins)} />
              <TextField label="Close rate" inputMode="decimal" placeholder="15" value={rate} onChange={digits(setRate)} leading={<span aria-hidden="true" className="text-by-muted">%</span>} />
            </div>
            <Checkbox label="Use these for every client without targets, and for new clients" checked={everyone} onCheckedChange={(v) => setEveryone(Boolean(v))} />
            {problem && <Notice tone="danger">{problem}</Notice>}
            <div><Button kind="primary" type="submit" loading={saving} disabled={!payload || !firstClient}>Save targets</Button></div>
          </form>
        )}
      </Bubble>
      {done && withTargets && <Reply>{withTargets.name}: {targetsLine(withTargets.targets, sym)}</Reply>}
    </>
  );
}
