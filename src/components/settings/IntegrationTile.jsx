// components/settings/IntegrationTile.jsx
// One connected-service row on Settings → Integrations, and the three controls
// its right-hand side is built from.
//
// Everything here is presentational: the row knows nothing about OAuth,
// tokens or the API. Settings keeps all of that and hands each row a status,
// a key/value line and whatever buttons that service actually supports — the
// four services differ enough (Slack has a channel picker, HotProspector
// connects through a credentials dialog, GHL and Meta can expire) that a
// data-driven list would be mostly exceptions.
//
// Laid out as a Frame row: logo, name and description on the left; status
// badge and buttons on the right. Rows stack below md.

import { ExternalLink } from "lucide-react"
import { AlertDiscIcon, Badge, Button, CheckDiscIcon, ClockDiscIcon, MinusDiscIcon } from "@/components/ds"
import { cn } from "@/lib/utils"

/** The badge on the right of a row. Keyed by the row's `status`. */
const STATUS_BADGES = {
  connected: { label: "Connected", tone: "success", icon: CheckDiscIcon },
  expired: { label: "Expired", tone: "danger", icon: AlertDiscIcon },
  checking: { label: "Checking…", tone: "neutral", icon: ClockDiscIcon },
  disconnected: { label: "Not connected", tone: "muted", icon: MinusDiscIcon },
}

/**
 * @param {string} name service name, shown beside the logo
 * @param {React.ReactNode} icon 16px glyph, drawn in `iconColor`
 * @param {string} [iconColor] CSS colour for the glyph (a brand colour from lib/brand-colors)
 * @param {string} description one line; wraps at narrow widths
 * @param {{label: string, value: React.ReactNode}} [meta] the key/value line
 * @param {"connected"|"expired"|"checking"|"disconnected"} status
 * @param {React.ReactNode} [children] extra control under the row (Slack's channel picker)
 * @param {React.ReactNode} actions buttons, right-aligned
 */
export function IntegrationTile({
  name,
  icon,
  iconColor,
  description,
  meta,
  status,
  children,
  actions,
}) {
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.disconnected

  return (
    <section data-slot="integration-row" className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-8">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden="true"
            style={iconColor ? { color: iconColor } : undefined}
            className="flex size-8 shrink-0 items-center justify-center rounded-control bg-muted text-muted-foreground"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h4 className="truncate text-base font-medium text-foreground">{name}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
            {meta && (
              <p className="mt-1 flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{meta.label}</span>
                <span className="num truncate font-medium text-foreground">{meta.value}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
          <Badge tone={badge.tone} icon={badge.icon}>{badge.label}</Badge>
          {actions}
        </div>
      </div>
      {children && <div className="md:pl-11">{children}</div>}
    </section>
  )
}

// The row controls. All three are the ds Button at its small height so a row
// with Connect and a row with Remove + the link end at the same line.

/** Outline, for Connect and Reconnect. */
export function IntegrationAction({ className, ...props }) {
  return <Button type="button" variant="outline" size="sm" className={className} {...props} />
}

/** Outline in the danger ink, for Remove. */
export function IntegrationDangerAction({ className, ...props }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("text-danger-ink hover:bg-danger-soft", className)}
      {...props}
    />
  )
}

/** The icon button that opens the service's own site in a new tab. */
export function IntegrationSiteLink({ href, label }) {
  return (
    <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
      >
        <ExternalLink aria-hidden="true" />
      </a>
    </Button>
  )
}
