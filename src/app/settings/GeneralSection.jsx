import { GeneralSettings } from "@/components/settings/GeneralSettings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Reveal } from "@/components/motion"
import { Loader2, CheckCircle2, Target, Sparkles } from "lucide-react"
import { STRICTNESS_OPTIONS } from "./constants"

// Settings → General: the GeneralSettings cards plus the Agent Capabilities
// block (Media Buying Analyst switch and suggestion strictness).
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
  return (
    <>
      <GeneralSettings
        slackConnected={Boolean(slackStatus?.installed)}
        brief={slackStatus?.brief}
        onBriefSaved={(brief) => setSlackStatus((prev) => ({ ...prev, brief }))}
      />

      {/* The design drops the Capabilities tab, but the Media Buying
          Analyst toggle behind it is real functionality — removing the
          tab must not remove the switch, so it lives here now. It
          arrives after the GeneralSettings cards above have settled. */}
      <Reveal delay={0.3} className="space-y-3">
        <div>
          <h2 className="font-pd-display text-lg font-semibold text-pd-ink mb-1">Agent Capabilities</h2>
          <p className="text-sm text-pd-subtle">
            Optional abilities for the Birdy AI agent. Turn these on to give Birdy extra expertise in chat — they take effect on your next Birdy conversation.
          </p>
        </div>

        <Separator />

        {/* Media Buying Analyst — injects senior-media-buyer reasoning into Birdy chat */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-pd-primary flex items-center justify-center shrink-0">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="font-pd-display text-base">Media Buying Analyst</CardTitle>
                      {capsLoaded && capabilities.media_buying && (
                        <Badge variant="default" className="text-[11px] font-bold">
                          <CheckCircle2 className="h-3 w-3 mr-1" />Enabled
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      Adds senior media-buyer reasoning to Birdy chat — it diagnoses CPL, CTR, CPM and ROAS
                      across campaigns, ad sets and ads, judges lead quality through GoHighLevel, and recommends
                      what to scale, kill, and fix. Applies to the Campaigns, Dashboard, client, and Ask&nbsp;Birdy
                      chats (not the Alerts or Metrics assistants).
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    {savingCapability === "media_buying" && (
                      <Loader2 className="h-4 w-4 animate-spin text-pd-subtle" />
                    )}
                    <Switch
                      checked={!!capabilities.media_buying}
                      onCheckedChange={(v) => toggleCapability("media_buying", v)}
                      disabled={!capsLoaded || savingCapability === "media_buying"}
                      aria-label="Toggle the Media Buying Analyst capability"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          {capsLoaded && capabilities.media_buying && (
            <CardContent className="pt-0 sm:pl-[88px]">
              <div className="rounded-xl border border-pd-border p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="suggestion-strictness" className="text-sm font-medium">
                    How strict should Birdy be when flagging ads?
                  </Label>
                  {savingStrictness && (
                    <Loader2 className="h-4 w-4 animate-spin text-pd-subtle" />
                  )}
                </div>
                <Select
                  value={strictness}
                  onValueChange={changeStrictness}
                  disabled={!strictnessLoaded || savingStrictness}
                >
                  <SelectTrigger id="suggestion-strictness" className="w-full sm:w-[260px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRICTNESS_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-pd-subtle">
                  {STRICTNESS_OPTIONS.find(o => o.value === strictness)?.detail}{" "}
                  Applies to the weekly and monthly ad suggestions on your dashboard and in Slack. Amounts are in your account currency.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        <p className="text-xs text-pd-subtle flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          More capabilities are coming. Have one in mind? Let us know.
        </p>
      </Reveal>
    </>
  )
}
