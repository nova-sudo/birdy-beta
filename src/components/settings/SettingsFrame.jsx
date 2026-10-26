// components/settings/SettingsFrame.jsx
// The building blocks of a settings section, from Paper's Settings screen: a
// content header (title and description), section Frames, and rows with the
// label and description on the left and the control on the right. Rows stack
// below md.

import { Frame, Label } from "@/components/ds"
import { cn } from "@/lib/utils"

/** Title and description at the top of a section's content. */
export function SectionHeader({ title, description }) {
  return (
    <header data-slot="settings-section-header" className="flex flex-col gap-0.5">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </header>
  )
}

/**
 * A section Frame: muted shell with a head, and a white body that holds the rows.
 *
 * @param {React.ReactNode} title
 * @param {React.ReactNode} [description] Muted line under the title
 * @param {React.ReactNode} [actions] Control in the head, e.g. a Switch for the whole section
 */
export function SettingsFrame({ title, description, actions, children, className }) {
  return (
    <Frame
      title={title}
      titleAs="h3"
      description={description}
      action={actions}
      className={className}
      contentClassName="divide-y divide-divider"
    >
      {children}
    </Frame>
  )
}

/**
 * One setting: label and description on the left, the control on the right.
 *
 * @param {React.ReactNode} label
 * @param {React.ReactNode} [description]
 * @param {string} [htmlFor] Id of the control, so the label is its accessible name
 * @param {boolean} [wide] Give the text the room and shrink the control to its size (a lone Switch with a long description)
 */
export function SettingRow({ label, description, htmlFor, wide = false, children, className }) {
  return (
    <div
      data-slot="setting-row"
      className={cn("flex flex-col gap-2 px-5 py-3 md:flex-row md:items-center md:gap-8", className)}
    >
      <div className={cn("min-w-0", wide ? "md:flex-1" : "md:w-70 md:shrink-0")}>
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-base leading-tight">{label}</Label>
        ) : (
          <p className="text-base font-medium leading-tight text-foreground">{label}</p>
        )}
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className={cn("flex min-w-0 items-center gap-2 md:justify-end", wide ? "shrink-0" : "grow")}>{children}</div>
    </div>
  )
}

/** A full-width row for content that has no left/right split (cards, notes). */
export function SettingBlock({ children, className }) {
  return (
    <div data-slot="setting-block" className={cn("flex flex-col gap-3 px-5 py-3", className)}>
      {children}
    </div>
  )
}

/** The save row at the bottom-right of a Frame body. */
export function FrameFooter({ children }) {
  return <div className="flex items-center justify-end gap-2 px-5 py-3">{children}</div>
}
