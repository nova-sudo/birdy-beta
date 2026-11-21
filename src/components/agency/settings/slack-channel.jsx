"use client";

// The Slack card's channel: where Birdy posts its AI suggestions. The list of
// channels is fetched the first time the menu opens.

import { useState } from "react";
import { Hash, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button, DropdownTrigger, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Notice } from "@/components/by";
import { apiRequest } from "@/lib/api";

/**
 * @param {object} props.slack Slack's status: `notify_channel_id`, `notify_channel_name`
 * @param {(patch: object) => void} props.onSaved
 * @param {() => void} props.onReconnect
 */
export function SlackChannel({ slack, onSaved, onReconnect }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (channels.length > 0 || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await apiRequest("/api/integrations/slack/channels");
      if (!res.ok) throw new Error("list failed");
      const data = await res.json();
      setChannels(data.channels || []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const save = async (channelId) => {
    const chan = channels.find((c) => c.id === channelId);
    setSaving(true);
    try {
      const res = await apiRequest("/api/integrations/slack/channel", {
        method: "PUT",
        body: JSON.stringify({ channel_id: channelId, channel_name: chan?.name || null }),
      });
      if (!res.ok) throw new Error("save failed");
      onSaved({ notify_channel_id: channelId, notify_channel_name: chan?.name || null });
      toast.success(channelId ? `Suggestions will post to #${chan?.name}` : "Suggestion posting turned off");
    } catch {
      toast.error("Couldn't save channel");
    } finally {
      setSaving(false);
    }
  };

  if (failed) {
    return (
      <Notice tone="warning" action={<Button size="sm" onClick={onReconnect}>Reconnect Slack</Button>}>
        Couldn’t load channels. Your Slack connection predates channel support; reconnect it to choose one.
      </Notice>
    );
  }

  const current = slack.notify_channel_id ? `#${slack.notify_channel_name || slack.notify_channel_id}` : null;
  return (
    <div>
      <p className="mb-1.5 text-by-caption font-medium text-by-text-2">Posts AI suggestions to</p>
      <Menu onOpenChange={(o) => o && load()}>
        <MenuTrigger asChild disabled={saving}>
          <DropdownTrigger className="w-full" leading={saving ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Hash aria-hidden="true" />} aria-label={`Channel Birdy posts AI suggestions to: ${current ?? "none"}`}>
            {current ?? <span className="text-by-muted">Don’t post</span>}
          </DropdownTrigger>
        </MenuTrigger>
        <MenuContent align="start" className="max-h-72 overflow-y-auto">
          <MenuItem selected={!slack.notify_channel_id} onSelect={() => save(null)}>Don’t post</MenuItem>
          <MenuSeparator />
          {loading && <MenuItem disabled><Loader2 aria-hidden="true" className="animate-spin" />Loading channels…</MenuItem>}
          {channels.map((c) => (
            <MenuItem key={c.id} selected={c.id === slack.notify_channel_id} onSelect={() => save(c.id)}>
              {c.is_private ? <Lock aria-hidden="true" /> : <Hash aria-hidden="true" />}
              {c.name}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}
