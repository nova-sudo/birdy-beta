"use client";

import { useState } from "react";
import useSWR from "swr";
import { Hash } from "lucide-react";
import { Button, Notice, OptionCard, SearchField, Skeleton } from "@/components/by";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Bubble, Chips, ConnectCard, Reply, Say } from "./chat-parts";

const cardState = (step, pending) => (pending === "connecting" || pending === "error" ? pending : step === "issue" ? "issue" : step === "todo" ? "todo" : "done");
const REPORT = ["Yes, every morning at 9:00", "Not now"];

/** Slack: connect it (an OAuth hop), pick the channel, and optionally turn on the standard daily report. */
export function SlackStep({ ctx }) {
  const { facts, steps, actions, agentName, refresh } = ctx;
  const slack = facts.slack || {};
  const saved = facts.onboarding?.data?.slack || null;
  const state = cardState(steps.slack, actions.pending.slack);
  const picking = steps.slack === "setup";
  const channel = slack.notify_channel_name || saved?.channel_name || null;
  const reportAnswered = Boolean(saved?.frequency || saved?.report);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);

  const report = async (label) => {
    setBusy(label);
    setProblem(null);
    try {
      if (label === REPORT[0]) {
        const res = await apiRequest("/api/integrations/slack/brief", { method: "PUT", body: JSON.stringify({ frequency: "daily", time: "9:00 AM" }) });
        if (!res.ok) throw new Error("Couldn’t turn the report on. Check Slack is still connected, then try again.");
        const { brief } = await res.json();
        await actions.saveAnswers({ slack: { channel_id: slack.notify_channel_id ?? saved?.channel_id ?? null, channel_name: channel, frequency: brief?.frequency ?? "daily", time: brief?.time ?? "9:00 AM" } });
      } else {
        await actions.saveAnswers({ slack: { channel_id: slack.notify_channel_id ?? saved?.channel_id ?? null, channel_name: channel, report: "later" } });
      }
    } catch (e) {
      setProblem(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Bubble name={agentName} id="step-slack">
        <Say>Where should I post alerts and your daily report? Connect Slack and pick a channel.</Say>
        <div className="flex max-w-xl flex-col gap-2.5">
          <ConnectCard
            tool="slack"
            name="Slack"
            what="I only post to the channel you pick. I can’t read your other messages."
            state={state}
            problem={actions.pending.slack === "error" ? actions.errors.slack : "Slack stopped accepting Birdy. Connect it again."}
            onConnect={() => actions.startOAuth("slack")}
          >
            {picking && <ChannelPicker actions={actions} refresh={refresh} />}
          </ConnectCard>
        </div>
      </Bubble>
      {steps.slack === "done" && (
        <>
          <Reply>{channel ? `#${channel}` : "Carry on without a channel"}</Reply>
          <Bubble name={agentName}>
            <Say>{channel ? `I’ll post to #${channel}.` : "You can pick a channel later in Settings."} Want the standard daily report there? You can design your own in Reports.</Say>
            {!reportAnswered && (
              <>
                <Chips label="Daily report" items={REPORT} recommended={REPORT[0]} onPick={report} busy={busy} />
                {problem && <Notice tone="danger">{problem}</Notice>}
              </>
            )}
          </Bubble>
          {reportAnswered && <Reply>{saved.frequency ? "Yes, every morning at 9:00" : "Not now"}</Reply>}
        </>
      )}
    </>
  );
}

async function loadChannels(url) {
  const res = await apiRequest(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.detail || "Couldn’t load your Slack channels.");
    // 409: Slack refused the token or a scope is missing. Retrying can't fix that; connecting again can.
    err.reconnect = res.status === 409;
    throw err;
  }
  return body.channels || [];
}

/** The workspace's channels to pick from. A failed list is not an empty one: it says why, and lets them carry on. */
function ChannelPicker({ actions, refresh }) {
  const { data: channels, error, mutate, isValidating } = useSWR(queryKeys.slackChannels(), loadChannels, { dedupingInterval: 0 });
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);

  const save = async () => {
    setSaving(true);
    setProblem(null);
    try {
      if (picked) {
        const res = await apiRequest("/api/integrations/slack/channel", { method: "PUT", body: JSON.stringify({ channel_id: picked.id, channel_name: picked.name }) });
        if (!res.ok) throw new Error("That channel wasn’t saved. Try again.");
        await actions.saveAnswers({ slack: { channel_id: picked.id, channel_name: picked.name } });
      } else {
        // Only reachable when the list failed: moving on writes nothing over a channel the account may already use.
        await actions.saveAnswers({ slack: { channel_id: null, channel_name: null } });
      }
      refresh("slack");
    } catch (e) {
      setProblem(e.message);
    } finally {
      setSaving(false);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = (channels || []).filter((c) => !q || (c.name || "").toLowerCase().includes(q));
  return (
    <div className="mt-3 flex flex-col gap-2.5 border-t border-by-line-soft pt-3">
      {error ? (
        <Notice
          tone="danger"
          action={error.reconnect
            ? <Button size="sm" onClick={() => actions.startOAuth("slack")}>Reconnect Slack</Button>
            : <Button size="sm" loading={isValidating} onClick={() => mutate()}>Try again</Button>}
        >
          <b>Couldn’t load your channels.</b> {error.message}
        </Notice>
      ) : !channels ? (
        <div role="status" aria-label="Loading your Slack channels" className="flex flex-col gap-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-2/3" /></div>
      ) : (
        <>
          <SearchField placeholder="Search channels" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div role="radiogroup" aria-label="Slack channel" className="flex max-h-56 flex-col gap-1.5 overflow-y-auto overscroll-contain">
            {shown.length === 0 ? (
              <p className="px-1 py-2 text-by-body-sm text-by-muted">{channels.length ? "No channel matches that search." : "No channels yet. Invite the Birdy app to a channel in Slack, then try again."}</p>
            ) : shown.map((c) => (
              <OptionCard key={c.id} selected={picked?.id === c.id} onSelect={() => setPicked(c)} title={<span className="inline-flex items-center gap-1"><Hash aria-hidden="true" className="size-3.5 text-by-muted" />{c.name}</span>} />
            ))}
          </div>
        </>
      )}
      {problem && <Notice tone="danger">{problem}</Notice>}
      <div>
        <Button kind="primary" loading={saving} disabled={!picked && !error} onClick={save}>{picked || !error ? "Use this channel" : "Carry on without a channel"}</Button>
      </div>
    </div>
  );
}
