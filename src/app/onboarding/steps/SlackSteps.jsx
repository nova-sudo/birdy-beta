import { Button, Notice, Skeleton, Surface } from "@/components/ds"
import {
  IconChip,
  PickList,
  SearchInput,
  SlackGlyph,
  SlackPreviewCard,
  STEP_COL,
  STEP_COL_WIDE,
  StepHeading,
  WizardFooter,
} from "../parts"
import ConnectStates from "./ConnectStates"

export function SlackConnectStep({ slackStatus, setSlackStatus, startOAuth, oauthError, next }) {
  return (
    <div className={STEP_COL}>
      <IconChip tone="warning"><SlackGlyph /></IconChip>
      <StepHeading
        description="Birdy will post alerts and daily summaries to a channel you choose. It only ever posts — it can't read your other messages."
      >
        Let&apos;s connect Birdy to your Slack for notifications.
      </StepHeading>
      <ConnectStates
        status={slackStatus}
        onConnect={() => startOAuth("/api/connect/slack", setSlackStatus)}
        onContinue={() => next()}
        connectLabel="Connect Slack"
        connectingLabel="Connecting to Slack…"
        successLabel="Slack connected"
        errorTitle="Connection failed"
        errorBody="Slack didn't authorize the request — this usually means the popup was closed early. Let's try again."
        oauthError={oauthError}
      />
    </div>
  )
}

export function SlackChannelStep({
  clientDisplayName,
  currencySymbol,
  cpa,
  channels,
  setChannels,
  channelsError,
  channelSearch,
  setChannelSearch,
  selectedChannel,
  setSelectedChannel,
  setSlackStatus,
  startOAuth,
  saveChannel,
}) {
  const channelQuery = channelSearch.toLowerCase()
  const channelItems = (channels || [])
    .filter((c) => (c.name || "").toLowerCase().includes(channelQuery))
    .map((c) => ({
      id: c.id,
      title: c.name,
      sub: null,
      leading: <span className="text-sm text-muted-foreground">#</span>,
      raw: c,
    }))

  return (
    <div className={STEP_COL_WIDE}>
      <StepHeading>Where should Birdy briefs go on Slack?</StepHeading>
      <div className="flex flex-col items-start gap-6 sm:flex-row">
        <div className="w-full flex-1">
          {channels === null ? (
            <Surface padded={false} className="mb-6 overflow-hidden">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 border-t border-border/60 px-4 py-3 first:border-t-0">
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="h-3.5 w-1/2" />
                </div>
              ))}
            </Surface>
          ) : channelsError ? (
            // Our failure, not their setup. Say what actually went
            // wrong, offer the retry that used to require reloading
            // the wizard, and let them past — see the Continue button
            // below for why this cannot be a wall.
            <Notice
              tone="danger"
              title="Couldn't load your channels"
              className="items-start"
              action={
                channelsError.needsReconnect ? (
                  <Button variant="link" size="sm" onClick={() => startOAuth("/api/connect/slack", setSlackStatus)}>
                    Reconnect Slack
                  </Button>
                ) : (
                  <Button variant="link" size="sm" onClick={() => setChannels(null)}>
                    Try again
                  </Button>
                )
              }
            >
              {channelsError.message}
            </Notice>
          ) : (
            <>
              <SearchInput
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                placeholder="Search channels…"
              />
              <PickList
                items={channelItems}
                selectedId={selectedChannel?.id}
                onPick={(item) => setSelectedChannel(item.raw)}
                maxHeight={220}
                emptyText="No channels found — invite the Birdy app to a channel in Slack"
              />
            </>
          )}
        </div>
        <div className="w-full flex-1">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Preview</div>
          <SlackPreviewCard time="9:02 AM">
            CPA for {clientDisplayName} is {currencySymbol}{cpa || "45"} — right on target. Yesterday&apos;s
            spend was {currencySymbol}142 across 3 ad sets.
          </SlackPreviewCard>
          {/* Requiring Slack means requiring the connection, not
              holding someone hostage to a call of ours that failed.
              With the "I don't use Slack" escape gone, gating this on
              a channel the list could not even load is a dead end
              with no way out but abandoning setup — and it caught
              exactly the accounts least deserving of it: one with
              Slack installed and a brief channel already configured
              was locked out of its own onboarding, because the
              endpoint that lists channels wanted a scope the install
              predated. So a failed lookup lets them through with
              whatever channel is already set, and the brief step
              after this can be revisited from Settings. A workspace
              that genuinely has no channels still has to pick one. */}
          <WizardFooter
            primary={{ label: "Continue", disabled: !selectedChannel && !channelsError, onClick: saveChannel }}
          />
        </div>
      </div>
    </div>
  )
}
