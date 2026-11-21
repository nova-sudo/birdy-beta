"use client";

// Settings › Connections: the four sources (GoHighLevel, Meta, HotProspector,
// Slack), lead tracking per client, and Birdy in your own AI app.

import { useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, Notice, TextField } from "@/components/by";
import { connectionState, formatDate } from "@/lib/integrations";
import { ConnectionCard, RemoveConnection } from "./connection-card";
import { SlackChannel } from "./slack-channel";
import { LeadTracking } from "./lead-tracking";
import { ConnectAI } from "./connect-ai";
import { INTEGRATION_LABEL } from "./use-integrations";

/** Connect, or "Checking…" until the first status lands. */
function ConnectButton({ checking, busy, onClick, children = "Connect" }) {
  return (
    <Button kind="primary" size="sm" loading={busy || checking} onClick={onClick}>
      {checking ? "Checking…" : children}
    </Button>
  );
}

/** A token connection's status line: when it expires, or that it has. */
function tokenMeta(status) {
  const date = formatDate(status.expires_at);
  if (!status.connected) return [];
  if (status.token_expired) return [["Status", date ? `Expired · ${date}` : "Expired"]];
  return [["Status", date ? `Connected · expires ${date}` : "Connected"]];
}

/** Meta and GoHighLevel: OAuth, so Connect and Reconnect leave for the provider. */
function OAuthCard({ type, name, mark, markClass, what, status, integrations, site, stopsWhat }) {
  const { checking, busy, removing, connect, remove } = integrations;
  const state = connectionState(status, checking);
  return (
    <ConnectionCard
      name={name}
      mark={mark}
      markClass={markClass}
      what={what}
      state={state}
      meta={tokenMeta(status)}
      warning={state === "expired" ? `Reconnect to keep ${stopsWhat} updating.` : null}
      site={site}
      actions={
        status.connected ? (
          status.token_expired && (
            <Button kind="primary" size="sm" loading={busy} onClick={() => connect(type)}>
              {!busy && <RefreshCw aria-hidden="true" />}Reconnect
            </Button>
          )
        ) : (
          <ConnectButton checking={checking} busy={busy} onClick={() => connect(type)} />
        )
      }
      remove={status.connected && <RemoveConnection label={INTEGRATION_LABEL[type]} removing={removing === type} onConfirm={() => remove(type)} />}
    />
  );
}

/** HotProspector connects with an API UID and key, typed in a dialog. */
function HotProspectorConnect({ integrations }) {
  const [open, setOpen] = useState(false);
  const [creds, setCreds] = useState({ api_uid: "", api_key: "" });
  const close = () => {
    setOpen(false);
    setCreds({ api_uid: "", api_key: "" });
  };
  const submit = async (e) => {
    e.preventDefault();
    if (await integrations.connectHotprospector(creds)) close();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <ConnectButton checking={integrations.checking} busy={integrations.busy} onClick={() => setOpen(true)} />
      <DialogContent title="Connect HotProspector" description="Enter your HotProspector API credentials.">
        <form onSubmit={submit} className="contents">
          <DialogBody className="flex flex-col gap-4">
            <TextField label="API UID" placeholder="Enter your API UID" autoComplete="off" value={creds.api_uid} onChange={(e) => setCreds((c) => ({ ...c, api_uid: e.target.value }))} />
            <TextField label="API Key" type="password" placeholder="Enter your API Key" autoComplete="off" value={creds.api_key} onChange={(e) => setCreds((c) => ({ ...c, api_key: e.target.value }))} />
          </DialogBody>
          <DialogFooter className="justify-end">
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" kind="primary" loading={integrations.busy} disabled={!creds.api_uid || !creds.api_key}>Connect</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConnectionsSection({ integrations }) {
  const { ghl, facebook, hotprospector, slack, checking, busy, removing, error, remove, connectSlack, updateSlack } = integrations;
  const hpState = connectionState(hotprospector, checking);
  const slackState = connectionState(slack, checking);

  return (
    <>
      {error && <Notice tone="danger" icon={<AlertCircle aria-hidden="true" />}>{error}</Notice>}

      <div className="grid gap-3 min-[1000px]:grid-cols-2">
        <OAuthCard
          type="gohighlevel"
          name="GoHighLevel"
          mark="G"
          markClass="bg-by-success-bg text-by-success"
          what="CRM · leads, opportunities, revenue"
          status={ghl}
          integrations={integrations}
          stopsWhat="every CRM number"
          site={{ href: "https://www.gohighlevel.com", label: "Open GoHighLevel" }}
        />
        <OAuthCard
          type="facebook"
          name="Meta"
          mark="M"
          markClass="bg-by-buyer-bg text-by-buyer"
          what="Ads · spend, leads, campaigns"
          status={facebook}
          integrations={integrations}
          stopsWhat="ad spend and leads"
          site={{ href: "https://developers.facebook.com", label: "Open Meta for Developers" }}
        />
        <ConnectionCard
          name="Hot Prospector"
          mark="H"
          markClass="bg-by-warning-bg text-by-warning"
          what="Dialler · calls and outcomes"
          state={hpState}
          meta={hotprospector.connected && hotprospector.api_uid ? [["API UID", hotprospector.api_uid]] : []}
          site={{ href: "https://hotprospector.com", label: "Open Hot Prospector" }}
          actions={!hotprospector.connected && <HotProspectorConnect integrations={integrations} />}
          remove={hotprospector.connected && <RemoveConnection label={INTEGRATION_LABEL.hotprospector} removing={removing === "hotprospector"} onConfirm={() => remove("hotprospector")} />}
        />
        <ConnectionCard
          name="Slack"
          mark="S"
          markClass="bg-by-accent-soft text-by-accent"
          what="Talk to Birdy from Slack, and get its reports and AI suggestions"
          state={slackState}
          meta={slack.installed ? [["Workspace", slack.team_name || slack.team_id || "—"]] : []}
          site={{ href: "https://slack.com", label: "Open Slack" }}
          actions={!slack.installed && <ConnectButton checking={checking} busy={busy} onClick={connectSlack} />}
          remove={slack.installed && <RemoveConnection label={INTEGRATION_LABEL.slack} removing={removing === "slack"} onConfirm={() => remove("slack")} />}
        >
          {slack.installed && <SlackChannel slack={slack} onSaved={updateSlack} onReconnect={connectSlack} />}
        </ConnectionCard>
      </div>

      <LeadTracking />
      <ConnectAI />
    </>
  );
}
