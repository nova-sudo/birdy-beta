import {
  Badge,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Switch,
  CheckDiscIcon,
} from "@/components/ds"
import { GeneralSettings } from "@/components/settings/GeneralSettings"
import { SettingBlock, SettingRow, SettingsFrame } from "@/components/settings/SettingsFrame"
import { Loader2, Sparkles } from "lucide-react"
import { STRICTNESS_OPTIONS } from "./constants"

// Settings → General: the GeneralSettings Frames plus the Agent Capabilities
// Frame (Media Buying Analyst switch and suggestion strictness).
export function GeneralSection({
  slackStatus,
  setSlackStatus,
  capabilities,
  capsLoaded,
  savingCapability,
  toggleCapability,
  strictness,
  strictnessLoaded,
  savingStrictness,
  changeStrictness,
}) {
  const analystOn = capsLoaded && capabilities.media_buying

  return (
    <>
      <GeneralSettings
        slackConnected={Boolean(slackStatus?.installed)}
        brief={slackStatus?.brief}
        onBriefSaved={(brief) => setSlackStatus((prev) => ({ ...prev, brief }))}
      />

      {/* The design drops the Capabilities tab, but the Media Buying
          Analyst toggle behind it is real functionality — removing the
          tab must not remove the switch, so it lives here now. */}
      <SettingsFrame title="Agent Capabilities">
        <SettingBlock>
          <p className="text-sm text-muted-foreground">
            Optional abilities for the Birdy AI agent. Turn these on to give Birdy extra expertise in chat — they take effect on your next Birdy conversation.
          </p>
        </SettingBlock>

        {/* Media Buying Analyst — injects senior-media-buyer reasoning into Birdy chat */}
        <SettingRow
          wide
          label={
            <span className="flex items-center gap-2">
              Media Buying Analyst
              {analystOn && (
                <Badge tone="success" icon={CheckDiscIcon}>
                  Enabled
                </Badge>
              )}
            </span>
          }
          description={
            <>
              Adds senior media-buyer reasoning to Birdy chat — it diagnoses CPL, CTR, CPM and ROAS
              across campaigns, ad sets and ads, judges lead quality through GoHighLevel, and recommends
              what to scale, kill, and fix. Applies to the Campaigns, Dashboard, client, and Ask&nbsp;Birdy
              chats (not the Alerts or Metrics assistants).
            </>
          }
        >
          {savingCapability === "media_buying" && (
            <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
          )}
          <Switch
            checked={!!capabilities.media_buying}
            onCheckedChange={(v) => toggleCapability("media_buying", v)}
            disabled={!capsLoaded || savingCapability === "media_buying"}
            aria-label="Toggle the Media Buying Analyst capability"
          />
        </SettingRow>

        {analystOn && (
          <SettingRow
            htmlFor="suggestion-strictness"
            label="How strict should Birdy be when flagging ads?"
            description={
              <>
                {STRICTNESS_OPTIONS.find(o => o.value === strictness)?.detail}{" "}
                Applies to the weekly and monthly ad suggestions on your dashboard and in Slack. Amounts are in your account currency.
              </>
            }
          >
            {savingStrictness && (
              <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
            )}
            <Select
              value={strictness}
              onValueChange={changeStrictness}
              disabled={!strictnessLoaded || savingStrictness}
            >
              <SelectTrigger id="suggestion-strictness" className="w-full md:w-65">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRICTNESS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        )}

        <SettingBlock>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles aria-hidden className="size-3" />
            More capabilities are coming. Have one in mind? Let us know.
          </p>
        </SettingBlock>
      </SettingsFrame>
    </>
  )
}
