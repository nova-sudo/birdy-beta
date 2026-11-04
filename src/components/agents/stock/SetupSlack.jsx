"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Lock } from "lucide-react"

import { Button, Frame, Label, Notice, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@/components/ds"
import { fetcher } from "@/lib/fetcher"
import { queryKeys } from "@/lib/query-keys"
import { ErrorNotice, SetupFooter, saveMessage, settingsOf } from "./SetupShared"

/** Step 4: where cards and reports are posted. Optional: without Slack everything works in Birdy. */
export function SetupSlack({ agent, actions, onBack, onNext, saveLabel }) {
  const { data: status, error: statusError, isLoading } = useSWR(queryKeys.slackStatus(), fetcher)
  const connected = Boolean(status?.installed)
  const { data: channelData, error: channelError } = useSWR(connected ? queryKeys.slackChannels() : null, fetcher)
  const channels = channelData?.channels ?? []
  const stored = settingsOf(agent).slack
  const [channelId, setChannelId] = useState(stored.channel_id ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    // Nothing to save without Slack, or when the channel is as it was.
    if (!connected || (channelId ?? null) === (stored.channel_id ?? null)) return onNext()
    setSaving(true)
    setError(null)
    const channel = channels.find((c) => c.id === channelId)
    try {
      await actions.patchSettings({
        settings: { slack: channelId ? { channel_id: channelId, channel_name: channel?.name ?? null } : { channel_id: null, channel_name: null } },
      })
      onNext()
      setSaving(false)
    } catch (err) {
      setError(saveMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-frame" />
      ) : !connected ? (
        <Notice
          tone="info"
          title={statusError ? "Couldn't check Slack" : "Slack isn't connected"}
          action={
            <Link href="/settings?tab=integrations" className="text-sm font-medium underline">
              Connect Slack
            </Link>
          }
        >
          {statusError
            ? "Birdy couldn't reach Slack to check. Reports and every action still work in Birdy. You can set Slack up later in Settings."
            : "Reports and every action still work in Birdy. Cards just won't reach Slack. You can connect it later."}
        </Notice>
      ) : (
        <Frame title="Slack channel" description="Birdy posts each client's card, the daily summary and the weekly message here." padded contentClassName="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label id="stock-slack-channel" className="text-xs text-muted-foreground">
              Channel
            </Label>
            <Select value={channelId ?? ""} onValueChange={setChannelId}>
              <SelectTrigger aria-labelledby="stock-slack-channel" className="w-full max-w-80">
                <SelectValue placeholder="Pick a channel" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    #{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {channelId && (
              <Button size="sm" variant="ghost" className="w-fit" onClick={() => setChannelId(null)}>
                Clear channel
              </Button>
            )}
            {channelError?.status === 409 ? (
              <Notice tone="warning" action={<Link href="/settings?tab=integrations" className="text-sm font-medium underline">Reconnect Slack</Link>}>
                {channelError.message}
              </Notice>
            ) : (
              channelError && <p className="text-xs text-danger-ink">{channelError.message || "Couldn't load your channels."} You can pick one later in Settings.</p>
            )}
          </div>
          <Notice tone="warning" icon={Lock}>
            Anyone in this channel can approve a card. Birdy records who pressed Apply on each decision.
          </Notice>
        </Frame>
      )}
      <ErrorNotice>{error}</ErrorNotice>
      <SetupFooter onBack={onBack} onNext={save} saving={saving} label={saveLabel} />
    </div>
  )
}
