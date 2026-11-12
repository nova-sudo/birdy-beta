"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"

import { Button, Frame, Label, Notice, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@/components/ds"
import { patchAgent } from "@/lib/agents-api"
import { fetcher } from "@/lib/fetcher"
import { queryKeys } from "@/lib/query-keys"
import { BlockFooter } from "./BlockFooter"

export const SKIP_SLACK = "Skip Slack for now"

/** Where the agent posts: a channel picker (the same data as the Media Buying setup), saved through patchAgent. */
export function SlackBlock({ agent, active, onSend, onSaved }) {
  const { data: status, isLoading } = useSWR(queryKeys.slackStatus(), fetcher)
  const connected = Boolean(status?.installed)
  const { data: channelData, error: channelError } = useSWR(connected ? queryKeys.slackChannels() : null, fetcher)
  const channels = channelData?.channels ?? []
  const [channelId, setChannelId] = useState(() => agent?.scope?.slack_channel_id ?? null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)

  const skip = () => {
    setSaved(SKIP_SLACK)
    onSend(SKIP_SLACK)
  }

  const save = async () => {
    if (!channelId) {
      setError("Pick a channel, or skip Slack for now.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSaved?.(await patchAgent(agent.id, { scope: { slack_channel_id: channelId } }))
      const text = `Post to #${channels.find((c) => c.id === channelId)?.name ?? "that channel"}`
      setSaved(text)
      onSend(text)
    } catch (err) {
      setError(`Couldn't save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <Skeleton className="h-28 w-full rounded-frame" />

  return (
    <div data-slot="setup-slack" className="flex flex-col gap-3">
      {!connected ? (
        <Notice
          tone="info"
          title="Slack isn't connected"
          action={
            <Link href="/settings?tab=integrations" className="text-sm font-medium underline">
              Connect Slack
            </Link>
          }
        >
          Every report and action still works in Birdy. You can pick a channel later.
        </Notice>
      ) : (
        <Frame title="Slack channel" titleAs="h3" padded>
          <div className="flex flex-col gap-1.5">
            <Label id="setup-slack-channel" className="text-xs text-muted-foreground">
              Channel
            </Label>
            <Select value={channelId ?? ""} onValueChange={setChannelId}>
              <SelectTrigger aria-labelledby="setup-slack-channel" className="w-full max-w-72">
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
            {channelError && <p className="text-xs text-danger-ink">{channelError.message || "Couldn't load your channels."}</p>}
          </div>
        </Frame>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      {connected ? (
        <BlockFooter saved={Boolean(saved)} savedLabel={saved} active={active} saving={saving} onSave={save} label="Use this channel">
          <Button size="sm" variant="ghost" onClick={skip}>
            Skip
          </Button>
        </BlockFooter>
      ) : (
        <BlockFooter saved={Boolean(saved)} savedLabel={saved} active={active} onSave={skip} label={SKIP_SLACK} />
      )}
    </div>
  )
}
