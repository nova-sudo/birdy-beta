import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Stagger, StaggerItem } from "@/components/motion"
import { Loader2, AlertCircle, Plug2, Phone, Trash2 } from "lucide-react"
import {
  IntegrationTile,
  IntegrationAction,
  IntegrationDangerAction,
  IntegrationSiteLink,
} from "@/components/settings/IntegrationTile"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Settings → Integrations: the four service tiles (Slack, GoHighLevel, Meta,
// Hot Prospector) and the HotProspector credentials dialog.
export function IntegrationsSection({
  ghlStatus,
  facebookStatus,
  hotprospectorStatus,
  slackStatus,
  slackChannels,
  channelsLoading,
  channelsError,
  savingChannel,
  statusInitialLoading,
  hotprospectorDialogOpen,
  setHotprospectorDialogOpen,
  hotprospectorCredentials,
  setHotprospectorCredentials,
  isLoading,
  removingIntegration,
  error,
  handleConnect,
  loadSlackChannels,
  saveSlackChannel,
  handleConnectSlack,
  handleRemoveIntegration,
  handleHotprospectorConnect,
}) {
  // Tiles are a quarter of the row wide, so a full date-and-time stamp would
  // wrap onto its own line and break the key/value row. The date is the part
  // that matters for an expiring token anyway.
  const formatExpiry = (value) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return date.toLocaleDateString(undefined, {
      day: "2-digit", month: "2-digit", year: "numeric",
    })
  }

  // Reusable remove button with confirmation.
  //
  // `compact` drops it to an icon-only square: a tile that also needs a
  // Reconnect button has no room for two full-width labels beside the site
  // link, and the trash glyph is the same affordance the handoff draws.
  const RemoveButton = ({ integrationType, label, compact = false }) => {
    const isRemoving = removingIntegration === integrationType
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <IntegrationDangerAction
            disabled={isRemoving}
            aria-label={compact ? `Remove ${label}` : undefined}
            title={compact ? `Remove ${label}` : undefined}
            className={compact ? "w-[38px] flex-none px-0" : undefined}
          >
            {isRemoving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                {!compact && "Removing…"}
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" aria-hidden="true" />
                {!compact && "Remove"}
              </>
            )}
          </IntegrationDangerAction>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-pd-display">Remove {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your {label} credentials from Birdy. You will need
              to reconnect if you want to use this integration again. Client groups linked to
              this integration will lose their data source.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => handleRemoveIntegration(integrationType)}
            >
              Yes, remove it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }
  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-[14px]">
        <div>
          <h2 className="font-pd-display text-[16px] font-semibold text-pd-ink">
            Connected services
          </h2>
          <p className="mt-1 text-[13px] text-pd-faint">
            Manage your third-party service integrations
          </p>
        </div>

        {/* Four across on a wide screen, as the handoff draws it, folding
            to two and then one rather than shrinking a tile past the
            point its description and buttons still read. Each tile sits
            in a flex StaggerItem so it still stretches to the row. */}
        <Stagger gap={0.05} className="grid gap-[14px] sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem className="flex">
          <IntegrationTile
            name="Slack"
            chipClassName="bg-pd-primary-tint text-pd-primary"
            icon={
              <svg className="size-[15px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
            }
            description="Talk to Birdy AI from Slack — @mention or DM it directly."
            status={
              slackStatus.installed
                ? "connected"
                : statusInitialLoading ? "checking" : "disconnected"
            }
            meta={
              slackStatus.installed
                ? { label: "Workspace", value: slackStatus.team_name || slackStatus.team_id || "—" }
                : undefined
            }
            actions={
              <>
                {slackStatus.installed ? (
                  <RemoveButton integrationType="slack" label="Slack" />
                ) : (
                  <IntegrationAction
                    onClick={handleConnectSlack}
                    disabled={isLoading || statusInitialLoading}
                  >
                    {(isLoading || statusInitialLoading) && (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    )}
                    {statusInitialLoading ? "Checking…" : "Connect"}
                  </IntegrationAction>
                )}
                <IntegrationSiteLink href="https://slack.com" label="Open Slack" />
              </>
            }
          >
            {/* The handoff keeps this deliberately bare — no heading, no
                helper copy, just the channel Birdy posts suggestions to.
                The label lives on the control for screen readers. */}
            {slackStatus.installed && (
              channelsError ? (
                <Alert className="py-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-[11.5px]">
                    Couldn’t load channels — your Slack connection predates channel
                    support.{" "}
                    <button onClick={handleConnectSlack} className="font-semibold underline">
                      Reconnect Slack
                    </button>{" "}
                    to enable it.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="flex items-center gap-2">
                  <Select
                    value={slackStatus.notify_channel_id || ""}
                    onValueChange={saveSlackChannel}
                    disabled={savingChannel}
                    onOpenChange={(o) => { if (o) loadSlackChannels() }}
                  >
                    <SelectTrigger
                      aria-label="Channel Birdy posts AI suggestions to"
                      className="h-[34px] min-w-0 flex-1 text-[12.5px]"
                    >
                      <SelectValue
                        placeholder={channelsLoading ? "Loading channels…" : "Select a channel…"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Don’t post —</SelectItem>
                      {slackChannels.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.is_private ? "🔒 " : "# "}{c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {savingChannel && (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-pd-faint" />
                  )}
                </div>
              )
            )}
          </IntegrationTile>
          </StaggerItem>

          <StaggerItem className="flex">
          <IntegrationTile
            name="GoHighLevel"
            chipClassName="bg-pd-info-bg text-pd-info"
            icon={<Plug2 className="size-[15px]" />}
            description="CRM and marketing automation platform for agencies."
            status={
              ghlStatus.connected
                ? (ghlStatus.token_expired ? "expired" : "connected")
                : statusInitialLoading ? "checking" : "disconnected"
            }
            meta={
              ghlStatus.connected && ghlStatus.expires_at
                ? { label: "Expires", value: formatExpiry(ghlStatus.expires_at) }
                : undefined
            }
            actions={
              <>
                {ghlStatus.connected ? (
                  <>
                    {ghlStatus.token_expired && (
                      <IntegrationAction
                        onClick={() => handleConnect("gohighlevel")}
                        disabled={isLoading}
                      >
                        {isLoading && (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        )}
                        Reconnect
                      </IntegrationAction>
                    )}
                    <RemoveButton
                      integrationType="gohighlevel"
                      label="GoHighLevel"
                      compact={ghlStatus.token_expired}
                    />
                  </>
                ) : (
                  <IntegrationAction
                    onClick={() => handleConnect("gohighlevel")}
                    disabled={isLoading || statusInitialLoading}
                  >
                    {(isLoading || statusInitialLoading) && (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    )}
                    {statusInitialLoading ? "Checking…" : "Connect"}
                  </IntegrationAction>
                )}
                <IntegrationSiteLink
                  href="https://www.gohighlevel.com"
                  label="Open GoHighLevel"
                />
              </>
            }
          />
          </StaggerItem>

          <StaggerItem className="flex">
          <IntegrationTile
            name="Meta"
            chipClassName="bg-pd-info-bg text-pd-info"
            icon={
              <svg className="size-[15px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            }
            description="Access Facebook insights and marketing tools."
            status={
              facebookStatus.connected
                ? (facebookStatus.token_expired ? "expired" : "connected")
                : statusInitialLoading ? "checking" : "disconnected"
            }
            meta={
              facebookStatus.connected && facebookStatus.expires_at
                ? { label: "Expires", value: formatExpiry(facebookStatus.expires_at) }
                : undefined
            }
            actions={
              <>
                {facebookStatus.connected ? (
                  <>
                    {facebookStatus.token_expired && (
                      <IntegrationAction
                        onClick={() => handleConnect("facebook")}
                        disabled={isLoading}
                      >
                        {isLoading && (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        )}
                        Reconnect
                      </IntegrationAction>
                    )}
                    <RemoveButton
                      integrationType="facebook"
                      label="Meta (Facebook)"
                      compact={facebookStatus.token_expired}
                    />
                  </>
                ) : (
                  <IntegrationAction
                    onClick={() => handleConnect("facebook")}
                    disabled={isLoading || statusInitialLoading}
                  >
                    {(isLoading || statusInitialLoading) && (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    )}
                    {statusInitialLoading ? "Checking…" : "Connect"}
                  </IntegrationAction>
                )}
                <IntegrationSiteLink
                  href="https://developers.facebook.com"
                  label="Open Meta for Developers"
                />
              </>
            }
          />
          </StaggerItem>

          <StaggerItem className="flex">
          <IntegrationTile
            name="Hot Prospector"
            chipClassName="bg-pd-primary-tint text-pd-primary"
            icon={<Phone className="size-[15px]" />}
            description="Sales dialler and CRM — call and close data for Birdy."
            status={
              hotprospectorStatus.connected
                ? "connected"
                : statusInitialLoading ? "checking" : "disconnected"
            }
            meta={
              hotprospectorStatus.connected && hotprospectorStatus.api_uid
                // Labelled for what it actually is. The handoff calls this
                // row "Group ID", but the value we store and send is the
                // account's API UID.
                ? { label: "API UID", value: hotprospectorStatus.api_uid }
                : undefined
            }
            actions={
              <>
                {hotprospectorStatus.connected ? (
                  <RemoveButton integrationType="hotprospector" label="HotProspector" />
                ) : (
                  <Dialog open={hotprospectorDialogOpen} onOpenChange={setHotprospectorDialogOpen}>
                    <DialogTrigger asChild>
                      <IntegrationAction disabled={isLoading || statusInitialLoading}>
                        {(isLoading || statusInitialLoading) && (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        )}
                        {statusInitialLoading ? "Checking…" : "Connect"}
                      </IntegrationAction>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="font-pd-display">Connect HotProspector</DialogTitle>
                        <DialogDescription>Enter your HotProspector API credentials.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="api_uid">API UID</Label>
                          <Input
                            id="api_uid"
                            placeholder="Enter your API UID"
                            value={hotprospectorCredentials.api_uid}
                            onChange={(e) =>
                              setHotprospectorCredentials((prev) => ({ ...prev, api_uid: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="api_key">API Key</Label>
                          <Input
                            id="api_key"
                            type="password"
                            placeholder="Enter your API Key"
                            value={hotprospectorCredentials.api_key}
                            onChange={(e) =>
                              setHotprospectorCredentials((prev) => ({ ...prev, api_key: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setHotprospectorDialogOpen(false)
                            setHotprospectorCredentials({ api_uid: "", api_key: "" })
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleHotprospectorConnect}
                          disabled={isLoading || !hotprospectorCredentials.api_uid || !hotprospectorCredentials.api_key}
                        >
                          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Connect
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                <IntegrationSiteLink
                  href="https://hotprospector.com"
                  label="Open Hot Prospector"
                />
              </>
            }
          />
          </StaggerItem>
        </Stagger>
      </section>
    </>
  )
}
