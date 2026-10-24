import { AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  IconChip,
  PickList,
  PrimaryButton,
  SearchInput,
  SlackGlyph,
  SlackPreviewCard,
  STEP_COL,
  STEP_COL_WIDE,
  StepHeading,
} from "../parts"
import ConnectStates from "./ConnectStates"

export function SlackConnectStep({ slackStatus, setSlackStatus, startOAuth, oauthError, next }) {
  return (
    <div className={STEP_COL}>
      <IconChip className="bg-pd-warning-bg text-pd-warning"><SlackGlyph /></IconChip>
      <div className="mb-[10px]"><StepHeading>Let&apos;s connect Birdy to your Slack for notifications.</StepHeading></div>
      <div className="mb-7 text-[14px] leading-relaxed text-pd-body">
        Birdy will post alerts and daily summaries to a channel you choose. It only ever
        posts — it can&apos;t read your other messages.
      </div>
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
      leading: <span className="text-[14px] text-pd-faint">#</span>,
      raw: c,
    }))

  return (
    <div className={STEP_COL_WIDE}>
      <div className="mb-[22px] text-center">
        <StepHeading small>Where should Birdy briefs go on Slack?</StepHeading>
      </div>
      <div className="flex flex-col items-start gap-6 text-left sm:flex-row">
        <div className="w-full flex-1">
          {channels === null ? (
            <div className="mb-[22px] overflow-hidden rounded-xl border border-pd-border">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-[11px] border-b border-pd-row-border px-[14px] py-3 last:border-b-0">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3.5 w-1/2" />
                </div>
              ))}
            </div>
          ) : channelsError ? (
            // Our failure, not their setup. Say what actually went
            // wrong, offer the retry that used to require reloading
            // the wizard, and let them past — see the Continue button
            // below for why this cannot be a wall.
            <div className="rounded-xl border border-pd-danger-border bg-pd-danger-bg px-[14px] py-3 text-left">
              <div className="mb-[6px] flex items-center gap-[7px]">
                <AlertCircle className="h-[14px] w-[14px] shrink-0 text-pd-danger" strokeWidth={2.4} />
                <span className="text-[12.5px] font-semibold text-pd-danger">
                  Couldn&apos;t load your channels
                </span>
              </div>
              <div className="mb-[9px] text-[12px] leading-normal text-pd-body">
                {channelsError.message}
              </div>
              {channelsError.needsReconnect ? (
                <button
                  type="button"
                  onClick={() => startOAuth("/api/connect/slack", setSlackStatus)}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-pd-primary underline"
                >
                  Reconnect Slack
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setChannels(null)}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-pd-primary underline"
                >
                  Try again
                </button>
              )}
            </div>
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
          <div className="mb-[9px] text-[11px] font-bold tracking-[0.05em] text-pd-faint">PREVIEW</div>
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
          <div className="mt-5 text-center">
            <PrimaryButton
              disabled={!selectedChannel && !channelsError}
              onClick={saveChannel}
            >
              Continue
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
