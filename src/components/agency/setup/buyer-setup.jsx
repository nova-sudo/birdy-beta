"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import getSymbolFromCurrency from "currency-symbol-map";
import { Button, Notice, TextField } from "@/components/by";
import { apiRequest } from "@/lib/api";
import { isActive } from "@/lib/client-status";
import { callingTool, commonCpl, cplOf, cplWrites } from "@/lib/setup-steps";
import { Bubble, Chips, Known, Lead, Reply } from "./chat-parts";

const symbolOf = (code) => getSymbolFromCurrency(code || "GBP") || code || "£";
const CALLS = { ghl: "GoHighLevel", hp: "Hot Prospector" };

/** What Agency Ops' setup already told the other sections, as lines for Known. */
export function knownFromOps(facts, names) {
  const clients = facts.clients || [];
  const active = clients.filter(isActive).length;
  const tool = callingTool(facts);
  return [
    clients.length && `${clients.length} client${clients.length === 1 ? "" : "s"}${active !== clients.length ? `, ${active} active` : ""}`,
    facts.status?.facebook?.connected && facts.status?.gohighlevel?.agency?.connected && "Meta and GoHighLevel connected",
    CALLS[tool] ? `Calls come through ${CALLS[tool]}` : tool === "none" ? "Your team doesn’t call leads yet" : null,
    facts.slack?.notify_channel_name && `Alerts go to #${facts.slack.notify_channel_name} in Slack`,
  ].filter(Boolean);
}

/** Media Buyer: starts from what Agency Ops learned; asks only for each client's CPL limit. */
export function BuyerSetup({ ctx, onNext }) {
  const { facts, steps, names, refresh, currency } = ctx;
  const active = (facts.clients || []).filter(isActive);
  const already = active.filter((g) => cplOf(g) !== null).length;
  const sym = symbolOf(currency);
  const [amount, setAmount] = useState(() => (commonCpl(facts.clients) ?? "").toString());
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(null);
  const [problem, setProblem] = useState(null);
  const done = steps.cpl === "done";
  const ALL = amount ? `Use ${sym}${amount} for every client` : "Use one limit for every client";
  const SOME = "Set some differently";

  const write = async (label, list) => {
    setSaving(label);
    setProblem(null);
    try {
      const results = await Promise.all(list.map(({ id, cpl }) =>
        apiRequest(`/api/client-groups/${id}/targets`, { method: "PUT", body: JSON.stringify({ cpl }) }).then((r) => r.ok).catch(() => false)));
      const failed = results.filter((ok) => !ok).length;
      if (failed) setProblem(`${failed} of ${list.length} limits weren’t saved. Try again.`);
      refresh("clients");
    } finally {
      setSaving(null);
    }
  };

  const pick = (label) => {
    if (label === SOME) return setEditing(true);
    write(label, cplWrites(active, amount));
  };

  return (
    <>
      <Bubble name={names.buyer} first id="step-cpl">
        <p><Lead>I’m {names.buyer}.</Lead>From {names.ops} I already know:</p>
        <Known items={knownFromOps(facts, names)} />
        <p>What I still need: <b>a cost-per-lead limit for each client.</b> I check every client against it each morning. Most agencies use the same one for most clients{already ? `; ${already} of your ${active.length} already ${already === 1 ? "has" : "have"} one` : ""}.</p>
        {!done && !editing && (
          <div className="flex max-w-xl flex-col gap-3">
            <TextField
              label="Cost per lead limit"
              inputMode="decimal"
              placeholder="6.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              leading={<span aria-hidden="true" className="text-by-muted">{sym}</span>}
              className="max-w-48"
            />
            <Chips label="CPL limits" items={[ALL, SOME]} recommended={ALL} busy={saving} onPick={(l) => (l === ALL && !amount ? setProblem("Type a limit first.") : pick(l))} />
          </div>
        )}
        {problem && <Notice tone="danger">{problem}</Notice>}
      </Bubble>
      {editing && !done && (
        <>
          <Reply>{SOME}</Reply>
          <Bubble name={names.buyer}>
            <p>Change any limit here. Clients you leave empty get {amount ? `${sym}${amount}` : "no limit yet"}.</p>
            <div className="max-w-xl overflow-hidden rounded-by-lg border border-by-line bg-by-surface shadow-by-card">
              <ul className="max-h-80 overflow-y-auto overscroll-contain">
                {active.map((g) => {
                  const own = cplOf(g);
                  return (
                    <li key={g.id} className="flex items-center gap-3 border-t border-by-line-soft px-3.5 py-2 first:border-t-0">
                      <span className="min-w-0 flex-1 truncate text-by-body">{g.name}</span>
                      <TextField
                        aria-label={`${g.name}’s CPL limit`}
                        inputMode="decimal"
                        placeholder={own !== null ? String(own) : amount || "—"}
                        value={edits[g.id] ?? (own !== null ? String(own) : "")}
                        onChange={(e) => setEdits({ ...edits, [g.id]: e.target.value.replace(/[^\d.]/g, "") })}
                        leading={<span aria-hidden="true" className="text-by-muted">{symbolOf(g.ad_account_currency || currency)}</span>}
                        className="w-32 shrink-0"
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button kind="primary" loading={saving === "edit"} onClick={() => write("edit", cplWrites(active, amount, edits))}>Save limits</Button>
              <Button kind="ghost" disabled={Boolean(saving)} onClick={() => setEditing(false)}>Back</Button>
            </div>
          </Bubble>
        </>
      )}
      {done && (
        <Bubble name={names.buyer}>
          <p><Lead>{names.buyer} is set up.</Lead>Every active client has a CPL limit, and I’ll check each one against it every morning. {names.coach} is unlocked next.</p>
          <div><Button kind="primary" onClick={onNext}>Set up {names.coach}<ArrowRight aria-hidden="true" /></Button></div>
        </Bubble>
      )}
    </>
  );
}
