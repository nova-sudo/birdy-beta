"use client";

// The AI apps and developer tokens connected to Birdy: what each can do, when
// it was connected and last used, and Disconnect. Developers make a token here;
// it is shown once.

import { useCallback, useEffect, useState } from "react";
import { Plug } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Dialog, DialogBody, DialogContent, DialogFooter, Notice, Pill, Radio, RadioGroup, Skeleton, TextField } from "@/components/by";
import { apiRequest } from "@/lib/api";
import { ACCESS_LABEL, formatDate, formatRelative } from "@/lib/connect-ai";
import { AppTile } from "./app-tile";
import { copyText } from "./copy";

/** The owner's connections, with a way to reload them. `connections` is null until the first load. */
export function useMcpConnections() {
  const [connections, setConnections] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await apiRequest("/api/mcp/connections");
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      // The backend answers with a list; anything else counts as a failed load.
      if (!Array.isArray(data)) throw new Error("unexpected shape");
      setConnections(data);
      setLoadError(false);
    } catch {
      setLoadError(true);
      setConnections((c) => c ?? []);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { connections, loadError, load };
}

function TokenForm({ onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [access, setAccess] = useState("read");
  const [creating, setCreating] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await apiRequest("/api/mcp/tokens", { method: "POST", body: JSON.stringify({ name: name.trim(), access }) });
      if (!res.ok) throw new Error("create failed");
      onCreated(await res.json());
    } catch {
      toast.error("Couldn't create the token. Try again.");
    } finally {
      setCreating(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-by-md border border-by-line bg-by-canvas p-3.5">
      <TextField label="Token name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My script" maxLength={80} />
      <fieldset>
        <legend className="mb-1.5 text-by-body-sm font-medium">Access</legend>
        <RadioGroup value={access} onValueChange={setAccess} aria-label="Access">
          {["read", "write"].map((v) => <Radio key={v} value={v} label={ACCESS_LABEL[v]} />)}
        </RadioGroup>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" kind="primary" size="sm" loading={creating} disabled={!name.trim()}>Create token</Button>
        <Button kind="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

/** @param {ReturnType<typeof useMcpConnections>} props.state */
export function ConnectionsCard({ state }) {
  const { connections, loadError, load } = state;
  const [tokenOpen, setTokenOpen] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [revoking, setRevoking] = useState(null);
  const [busy, setBusy] = useState(false);

  const confirmRevoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      const res = await apiRequest(`/api/mcp/connections/${revoking.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("revoke failed");
      toast.success(`${revoking.name} disconnected`);
      setRevoking(null);
      await load();
    } catch {
      toast.error("Couldn't disconnect. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex min-w-0 flex-col gap-3.5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-by-lg bg-by-sunken text-by-text-2 [&_svg]:size-5"><Plug /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Your connections</h3>
          <p className="text-by-body-sm text-by-muted">AI apps and tokens that can reach Birdy</p>
        </div>
        <Button kind="ghost" size="sm" aria-expanded={tokenOpen} onClick={() => { setNewToken(null); setTokenOpen((o) => !o); }}>Create token for developers</Button>
      </div>

      {tokenOpen && (
        <TokenForm
          onCancel={() => setTokenOpen(false)}
          onCreated={(token) => { setNewToken(token); setTokenOpen(false); load(); }}
        />
      )}

      {newToken && (
        <div className="flex flex-col gap-2 rounded-by-md border border-by-accent-line bg-by-accent-soft p-3.5">
          <p className="text-by-body-sm font-medium">Token for {newToken.name}. This is the only time you&apos;ll see it, so copy it now.</p>
          <div className="flex min-w-0 items-center gap-2 rounded-by-md border border-by-line bg-by-surface py-1.5 pr-1.5 pl-3">
            <code className="min-w-0 flex-1 break-all font-mono text-by-body-sm">{newToken.token}</code>
            <Button size="sm" onClick={() => copyText(newToken.token, "Token copied")}>Copy token</Button>
          </div>
          <Button kind="ghost" size="sm" className="self-start" onClick={() => setNewToken(null)}>Done</Button>
        </div>
      )}

      {connections === null ? (
        <div aria-busy="true" aria-label="Loading your connections" className="flex flex-col gap-2">
          {[0, 1].map((i) => <Skeleton key={i} className="h-10 w-full rounded-by-md" />)}
        </div>
      ) : loadError ? (
        <Notice tone="danger" action={<Button size="sm" onClick={load}>Try again</Button>}>Couldn&apos;t load your connections.</Notice>
      ) : connections.length === 0 ? (
        <p className="rounded-by-md border border-dashed border-by-line-strong px-4 py-5 text-center text-by-body-sm text-by-muted">Nothing connected yet. Add Birdy to an AI app and it will show up here.</p>
      ) : (
        <ul aria-label="Connections" className="flex flex-col">
          {connections.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-by-line-soft py-2.5 first:border-t-0">
              <AppTile name={c.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{c.name}</span>
                  <Pill tone={c.access === "write" ? "accent" : "neutral"} dot={false}>{ACCESS_LABEL[c.access] || ACCESS_LABEL.read}</Pill>
                </div>
                <p className="text-by-caption text-by-muted">Connected {formatDate(c.created_at)} · Last used {formatRelative(c.last_used_at)}</p>
              </div>
              <Button kind="ghost" size="sm" className="text-by-danger hover:bg-by-danger-bg hover:text-by-danger" onClick={() => setRevoking(c)} aria-label={`Disconnect ${c.name}`}>Disconnect</Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(revoking)} onOpenChange={(o) => { if (!o && !busy) setRevoking(null); }}>
        {revoking && (
          <DialogContent title={`Disconnect ${revoking.name}?`}>
            <DialogBody>
              <p className="text-by-text-2">{revoking.name} will lose access to Birdy straight away. You can connect it again whenever you like.</p>
            </DialogBody>
            <DialogFooter className="justify-end">
              <Button kind="ghost" disabled={busy} onClick={() => setRevoking(null)}>Keep connected</Button>
              <Button kind="danger" loading={busy} onClick={confirmRevoke}>Disconnect</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
}
