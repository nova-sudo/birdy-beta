"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Files } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, Notice, OptionCard, Pill, SearchField, Skeleton, Stepper, TextField } from "@/components/by";
import { apiRequest } from "@/lib/api";
import { clearCache } from "@/lib/cache";
import { LEAD_SOURCE_OPTIONS, LEAD_SOURCE_UNKNOWN } from "@/lib/lead-sources";
import { sharesMetaAccount } from "@/lib/meta-scope";
import { CampaignPicker } from "./campaign-picker";

const STEPS = ["Name", "GoHighLevel", "Meta", "Calls", "Leads"];
const LEAD_SOURCES = [LEAD_SOURCE_UNKNOWN, ...LEAD_SOURCE_OPTIONS];
const CALL_PROVIDERS = [
  { key: "ghl", title: "GoHighLevel", subtitle: "Calls arrive through your GoHighLevel workflow webhook. Nothing more to set up." },
  { key: "hotprospector", title: "Hot Prospector", subtitle: "Calls sync from your account’s Hot Prospector connection. Nothing to enter here." },
];
const EMPTY = { name: "", location: null, account: null, campaignIds: null, provider: null, leadSource: "unknown" };

/** Loads a list when `active` turns true; exposes loading, error and retry. */
function useList(active, load) {
  const [state, setState] = useState({ items: [], loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load()
      .then((items) => live && setState({ items, loading: false, error: null }))
      .catch((e) => live && setState({ items: [], loading: false, error: e?.message || "Couldn’t load this list." }));
    return () => {
      live = false;
    };
    // `load` is stable per dialog; re-run only when the step opens or Retry is pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

async function loadLocations() {
  const res = await apiRequest("/api/subaccount/locations");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.detail || "Couldn’t load your GoHighLevel sub-accounts.");
  return body.locations || [];
}

async function loadAdAccounts() {
  const res = await apiRequest("/api/facebook/adaccounts");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Couldn’t load your Meta ad accounts.");
  return body.data?.data || [];
}

function ListState({ list, noun }) {
  if (list.error) return <Notice tone="danger" action={<Button size="sm" onClick={list.retry}>Retry</Button>}>{list.error}</Notice>;
  if (list.loading) {
    return (
      <div role="status" aria-label={`Loading ${noun}`} className="flex flex-col gap-1.5">
        {[58, 44, 66].map((w) => (
          <div key={w} className="rounded-by-md border border-by-line px-3 py-3.5"><Skeleton style={{ width: `${w}%` }} /></div>
        ))}
      </div>
    );
  }
  return null;
}

/** "Used by <client>", shortened when the client's name is long so the account's own name stays readable. */
function UsedBy({ name }) {
  return (
    <Pill tone="neutral" dot={false} className="max-w-52 shrink-0" title={`Used by ${name}`}>
      <span className="truncate">Used by {name}</span>
    </Pill>
  );
}

function StepHeading({ title, children }) {
  return (
    <div className="mb-3.5">
      <h3 className="font-by-display text-by-heading font-semibold">{title}</h3>
      <p className="mt-0.5 text-by-body-sm text-by-text-2">{children}</p>
    </div>
  );
}

/**
 * Add one client, in five steps: name, GoHighLevel sub-account, Meta ad
 * account, where calls come from, how leads arrive.
 *
 * The rules are today's: a sub-account and an ad account must be picked when
 * the agency has any; an ad account another client already uses needs its own
 * campaigns; a call provider must be chosen.
 *
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {object[]} props.clientGroups existing clients, to show which accounts are already used
 * @param {() => void} [props.onCreated] called after a client is created
 * @param {() => void} [props.onImportInstead] switches to the bulk import
 */
export function AddClientDialog({ open, onOpenChange, clientGroups, onCreated, onImportInstead }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [queries, setQueries] = useState({ location: "", account: "" });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Every opening starts clean; closing discards the answers.
  useEffect(() => {
    if (open) {
      setStep(0);
      setForm(EMPTY);
      setQueries({ location: "", account: "" });
      setProblem(null);
      setSaving(false);
    }
  }, [open]);

  const locations = useList(open && step >= 1, loadLocations);
  const accounts = useList(open && step >= 2, loadAdAccounts);

  const usedLocation = useMemo(() => new Map(clientGroups.filter((g) => g.ghl_location_id).map((g) => [g.ghl_location_id, g.name])), [clientGroups]);
  const accountUser = (id) => clientGroups.find((g) => sharesMetaAccount([g], id))?.name ?? null;
  const shared = Boolean(form.account) && sharesMetaAccount(clientGroups, form.account.id);
  // A shared account needs its own campaigns, and a list must not be empty.
  const campaignsMissing = Boolean(form.account) && (shared || Array.isArray(form.campaignIds)) && !(Array.isArray(form.campaignIds) && form.campaignIds.length > 0);

  const canContinue =
    step === 0 ? form.name.trim().length > 0
    // A list that failed to load is not an empty list: nothing may be skipped on a guess.
    : step === 1 ? !locations.loading && !locations.error && (Boolean(form.location) || locations.items.length === 0)
    : step === 2 ? !accounts.loading && !accounts.error && (Boolean(form.account) || accounts.items.length === 0) && !campaignsMissing
    : step === 3 ? Boolean(form.provider)
    : true;

  const create = async () => {
    setSaving(true);
    setProblem(null);
    try {
      const res = await apiRequest("/api/client-groups", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          ghl_location_id: form.location?.locationId || null,
          meta_ad_account_id: form.account?.id || null,
          hotprospector_group_id: null,
          ad_account_currency: form.account?.currency || null,
          meta_campaign_ids: form.account ? form.campaignIds : null,
          call_log_provider: form.provider || "ghl",
          lead_collection_method: form.leadSource,
          notes: "",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`“${form.name.trim()}” added. Its numbers appear once the first sync finishes.`);
        for (const g of body.converted || []) toast.info(`${g.name} now keeps the remaining campaigns`);
        clearCache("ghlLocations");
        onCreated?.();
        onOpenChange(false);
        return;
      }
      const detail = typeof body.detail === "string" ? body.detail : "";
      const owner = /^A client group named "([^"]+)"/.exec(detail)?.[1];
      if (res.status === 402 && body.detail?.code === "CLIENT_LIMIT_REACHED") setProblem({ kind: "limit" });
      else if (res.status === 409 && owner) setProblem({ kind: "in-use", owner });
      else setProblem({ kind: "other", message: detail || "Couldn’t add this client. Nothing was created." });
    } catch {
      setProblem({ kind: "other", message: "Couldn’t reach Birdy. Check your connection and try again; nothing was created." });
    } finally {
      setSaving(false);
    }
  };

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : create());
  const match = (text, q) => !q.trim() || (text || "").toLowerCase().includes(q.trim().toLowerCase());
  const shownLocations = locations.items.filter((l) => match(l.name, queries.location) || match(l.locationId, queries.location));
  const shownAccounts = accounts.items.filter((a) => match(a.name, queries.account) || match(a.id, queries.account));

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent title="Add client" description={step > 0 ? form.name.trim() : "Link a client’s accounts so Birdy can watch them."}>
        <Stepper steps={STEPS} current={step} className="shrink-0 border-b border-by-line-soft px-5 py-3.5" />
        <DialogBody className="min-h-[21rem]">
          {problem?.kind === "limit" && (
            <Notice tone="warning" className="mb-3.5" action={<Button size="sm" onClick={() => { onOpenChange(false); router.push("/billing"); }}>Go to billing</Button>}>
              Your plan’s client limit is full. Add client slots from Billing to continue.
            </Notice>
          )}
          {problem?.kind === "in-use" && (
            <Notice tone="danger" className="mb-3.5" action={<><Button size="sm" onClick={() => { setProblem(null); setStep(1); }}>Change GoHighLevel</Button><Button size="sm" onClick={() => { setProblem(null); setStep(2); }}>Change Meta</Button></>}>
              The GoHighLevel sub-account or Meta ad account you picked is already linked to “{problem.owner}”. Choose a different one.
            </Notice>
          )}
          {problem?.kind === "other" && <Notice tone="danger" className="mb-3.5">{problem.message}</Notice>}

          {step === 0 && (
            <>
              <StepHeading title="Name the client">A short name you’ll use to find this client later.</StepHeading>
              <TextField label="Client name" placeholder="e.g. Glow Aesthetics" autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && canContinue && next()} />
              {onImportInstead && (
                <Notice className="mt-4" icon={<Files aria-hidden="true" />} action={<Button size="sm" kind="soft" onClick={onImportInstead}>Import instead</Button>}>
                  Adding several clients? Import them together from GoHighLevel.
                </Notice>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <StepHeading title="Link a GoHighLevel sub-account">Contacts and opportunities for this client come from here.</StepHeading>
              {ListState({ list: locations, noun: "sub-accounts" }) ?? (locations.items.length === 0 ? (
                <Notice>No GoHighLevel sub-accounts found on your account. You can link one later from the client’s page.</Notice>
              ) : (
                <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="GoHighLevel sub-accounts">
                  <SearchField placeholder="Search sub-accounts by name or ID" value={queries.location} onChange={(e) => setQueries((q) => ({ ...q, location: e.target.value }))} />
                  {shownLocations.map((l) => (
                    <OptionCard
                      key={l.locationId}
                      selected={form.location?.locationId === l.locationId}
                      onSelect={() => set({ location: l })}
                      title={l.name || "Unnamed sub-account"}
                      subtitle={l.locationId}
                      aside={usedLocation.has(l.locationId) ? <UsedBy name={usedLocation.get(l.locationId)} /> : null}
                    />
                  ))}
                  {shownLocations.length === 0 && <p className="px-1 py-2 text-by-body-sm text-by-muted">No sub-account matches “{queries.location.trim()}”.</p>}
                </div>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <StepHeading title="Link a Meta ad account">Campaigns and spend for this client come from here.</StepHeading>
              {ListState({ list: accounts, noun: "ad accounts" }) ?? (accounts.items.length === 0 ? (
                <Notice>No Meta ad accounts found on your account. You can link one later from the client’s page.</Notice>
              ) : (
                <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Meta ad accounts">
                  <SearchField placeholder="Search ad accounts by name or ID" value={queries.account} onChange={(e) => setQueries((q) => ({ ...q, account: e.target.value }))} />
                  {shownAccounts.map((a) => {
                    const user = accountUser(a.id);
                    return (
                      <OptionCard
                        key={a.id}
                        selected={form.account?.id === a.id}
                        // Re-picking the same account must not wipe the campaigns already chosen.
                        onSelect={() => form.account?.id !== a.id && set({ account: a, campaignIds: sharesMetaAccount(clientGroups, a.id) ? [] : null })}
                        title={a.name || "Unnamed ad account"}
                        subtitle={a.id}
                        aside={user ? <UsedBy name={user} /> : null}
                      />
                    );
                  })}
                  {shownAccounts.length === 0 && <p className="px-1 py-2 text-by-body-sm text-by-muted">No ad account matches “{queries.account.trim()}”.</p>}
                </div>
              ))}
              {form.account && (
                <div className="mt-5">
                  <h4 className="text-by-body font-semibold">Campaigns</h4>
                  <p className="mt-0.5 mb-2.5 text-by-body-sm text-by-text-2">
                    {shared ? "Another client already uses this ad account. Pick the campaigns that belong to this one." : "Use every campaign, or only the ones that belong to this client."}
                  </p>
                  <CampaignPicker adAccountId={form.account.id} value={form.campaignIds} onChange={(campaignIds) => set({ campaignIds })} required={shared} />
                  {campaignsMissing && <p className="mt-2 text-by-caption text-by-warning">Pick at least one campaign to continue.</p>}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <StepHeading title="Where do calls come from?">The provider that feeds this client’s call logs.</StepHeading>
              <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Call provider">
                {CALL_PROVIDERS.map((p) => (
                  <OptionCard key={p.key} selected={form.provider === p.key} onSelect={() => set({ provider: p.key })} title={p.title} subtitle={p.subtitle} />
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <StepHeading title="How does this client get leads?">Only a client’s own landing page needs the Birdy pixel. You can decide later.</StepHeading>
              <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Lead source">
                {LEAD_SOURCES.map((o) => (
                  <OptionCard key={o.key} selected={form.leadSource === o.key} onSelect={() => set({ leadSource: o.key })} title={o.label} subtitle={o.brief} />
                ))}
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button disabled={step === 0 || saving} onClick={() => { setProblem(null); setStep(step - 1); }}><ArrowLeft aria-hidden="true" />Back</Button>
          <span className="flex-1" />
          <Button kind="primary" disabled={!canContinue} loading={saving} onClick={next}>{step < STEPS.length - 1 ? "Continue" : "Add client"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
