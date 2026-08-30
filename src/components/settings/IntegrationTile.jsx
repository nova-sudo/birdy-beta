// components/settings/IntegrationTile.jsx
// The chrome for one connected-service tile on Settings → Integrations, and
// the three controls its footer is built from.
//
// Everything here is presentational: the tile knows nothing about OAuth,
// tokens or the API. Settings keeps all of that and hands each tile a status,
// a key/value row and whatever buttons that service actually supports — the
// four services differ enough (Slack has a channel picker, HotProspector
// connects through a credentials dialog, GHL and Meta can expire) that a
// data-driven list would be mostly exceptions.
//
// Metrics come from design_handoff_app_settings: 14px radius, 30px icon chip,
// 34px minimum description height so the four tiles' key/value rows line up
// across the row, and footer actions pinned with mt-auto for the same reason.

import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

/** The badge in the top-right of a tile. Keyed by the tile's `status`. */
const STATUS_BADGES = {
  connected: { label: "Connected", className: "bg-pd-success-bg text-pd-success" },
  expired: { label: "Expired", className: "bg-pd-danger-surface text-pd-danger" },
  checking: { label: "Checking…", className: "bg-pd-divider text-pd-faint" },
  disconnected: { label: "Not connected", className: "bg-pd-divider text-pd-faint" },
}

/**
 * @param {string} name service name, shown beside the icon chip
 * @param {React.ReactNode} icon 15–16px glyph, coloured by `chipClassName`
 * @param {string} chipClassName background + text colour for the icon chip
 * @param {string} description one line; wraps to two at narrow widths
 * @param {{label: string, value: React.ReactNode}} [meta] the key/value row
 * @param {"connected"|"expired"|"checking"|"disconnected"} status
 * @param {React.ReactNode} [children] extra section above the footer (Slack)
 * @param {React.ReactNode} actions footer controls, pinned to the tile's base
 */
export function IntegrationTile({
  name,
  icon,
  chipClassName,
  description,
  meta,
  status,
  children,
  actions,
}) {
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.disconnected

  return (
    <section className="flex flex-col rounded-[14px] border border-pd-border bg-pd-surface px-[18px] py-4">
      <div className="mb-3.5 flex items-center gap-[9px]">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-[30px] shrink-0 items-center justify-center rounded-[9px]",
            chipClassName
          )}
        >
          {icon}
        </span>
        <h3 className="truncate font-pd-display text-[14px] font-semibold text-pd-ink">
          {name}
        </h3>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-md px-2 py-[3px] text-[10.5px] font-bold",
            badge.className
          )}
        >
          {badge.label}
        </span>
      </div>

      {/* min-height, not a fixed one: a description that wraps to two lines
          still pushes the row below it down, but a one-line description does
          not leave its tile's key/value row sitting a line higher than the
          other three. */}
      <p className="mb-3 min-h-[34px] text-[12px] leading-[1.45] text-pd-subtle">
        {description}
      </p>

      {meta && (
        <div className="mb-3.5 flex items-center justify-between gap-2">
          <span className="text-[12px] text-pd-subtle">{meta.label}</span>
          <span className="truncate text-[12px] font-semibold text-pd-ink">
            {meta.value}
          </span>
        </div>
      )}

      {children && (
        <div className="mb-3.5 border-t border-pd-divider pt-3">{children}</div>
      )}

      <div className="mt-auto flex items-center gap-2">{actions}</div>
    </section>
  )
}

// The footer controls. All three are 38px tall so a tile with a Connect button
// and a tile with Remove + the link square end at the same height.

const ACTION_BASE =
  "flex h-[38px] items-center justify-center gap-1.5 rounded-[9px] text-[12.5px] font-semibold " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"

/** Filled purple, for Connect and Reconnect. Fills the footer on its own. */
export function IntegrationAction({ className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        ACTION_BASE,
        "flex-1 bg-pd-primary px-3 text-white hover:bg-[#5B3FD6]",
        className
      )}
      {...props}
    />
  )
}

/** Tinted red, for Remove. Also fills the footer, with the link square beside it. */
export function IntegrationDangerAction({ className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        ACTION_BASE,
        "flex-1 border border-pd-danger-border bg-pd-danger-surface px-3 text-pd-danger",
        "hover:bg-pd-danger-bg",
        className
      )}
      {...props}
    />
  )
}

/** The square that opens the service's own site in a new tab. */
export function IntegrationSiteLink({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-[38px] shrink-0 items-center justify-center rounded-[9px]",
        "border border-pd-border text-pd-body transition-colors hover:bg-pd-canvas",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
      )}
    >
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  )
}
