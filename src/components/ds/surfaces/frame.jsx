"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "../primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../overlays/dropdown-menu"

/**
 * True inside a surface that already draws the frame (a Frame's content, a FrameSurface), so a
 * table set there draws only its rows rather than a second frame.
 */
const InsideFrameContext = React.createContext(false)

function useInsideFrame() {
  return React.useContext(InsideFrameContext)
}

/** A header shows at most this many actions; the rest fold into a ⋯ menu. */
const FRAME_ACTION_LIMIT = 2

/**
 * One panel for everything that groups content: a muted frame holds a header strip, a white
 * surface and an optional footer strip. The surface runs flush to the frame's sides and its ring
 * draws the seams; one hairline outlines the whole frame.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.title] The bold label in the header strip ("Summary", "Metrics")
 * @param {"h1"|"h2"|"h3"|"h4"} [props.titleAs="h2"] Heading element for the title
 * @param {React.ReactNode} [props.toolbar] Takes the header strip in place of the title, at a table toolbar's 56; name the frame with `aria-label` then
 * @param {React.ReactNode} [props.leading] Before the title: an avatar or icon for the record the frame is about
 * @param {React.ReactNode} [props.description] A short line under the title (or beside it with `descriptionInline`)
 * @param {React.ReactNode} [props.meta] Alias of `description`
 * @param {boolean} [props.descriptionInline=false] Sets the description beside the title from `sm` up
 * @param {React.ReactNode} [props.action] Controls on the right of the header; a button or link belongs in a `FrameAction`
 * @param {React.ReactNode|{label: string, href?: string, icon?: React.ElementType, onClick?: () => void, disabled?: boolean, destructive?: boolean}[]} [props.actions]
 *   Header actions as data: up to two show as `FrameAction`s (one when there is an `href`), the rest fold into a ⋯ menu.
 *   A node here is an alias of `action`.
 * @param {string} [props.href] Links the header to the full view of what the frame summarises
 * @param {string} [props.hrefLabel="View all"]
 * @param {React.ReactNode} [props.footer] A strip under the surface in the frame's muted tone; centres on a phone
 * @param {boolean} [props.padded=false] Puts 20 inside the surface, for forms and prose
 * @param {"default"|"staff"} [props.tone="default"] `staff` sets the frame in the primary colour
 * @param {string} [props.contentClassName]
 */
function Frame({
  title,
  titleAs: Title = "h2",
  toolbar,
  leading,
  description,
  meta,
  descriptionInline = false,
  action,
  actions,
  href,
  hrefLabel = "View all",
  footer,
  padded = false,
  tone = "default",
  className,
  contentClassName,
  children,
  ...props
}) {
  const titleId = React.useId()
  const staff = tone === "staff"
  const actionList = Array.isArray(actions) ? actions : undefined
  const actionNode = action ?? (actionList ? undefined : actions)
  const desc = description ?? meta
  const hasActions = Boolean(actionNode || href || actionList?.length)

  return (
    <section
      data-ds="frame"
      data-slot="frame"
      aria-labelledby={toolbar ? undefined : titleId}
      data-tone={tone}
      className={cn(
        "flex min-w-0 flex-col rounded-frame text-foreground",
        staff ? "bg-primary shadow-frame" : "bg-frame shadow-frame",
        className
      )}
      {...props}
    >
      {toolbar ? (
        <header data-slot="frame-header" className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 px-3 py-2">
          {toolbar}
        </header>
      ) : (
        <header
          data-slot="frame-header"
          className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2"
        >
          {leading && <div className="-mr-0.5 flex shrink-0 items-center">{leading}</div>}
          <div
            className={cn(
              "flex min-w-0 flex-[1_1_8rem] flex-col gap-0.5",
              descriptionInline && "sm:flex-row sm:items-baseline sm:gap-2"
            )}
          >
            <Title
              id={titleId}
              className={cn(
                "truncate text-base leading-5 font-semibold",
                staff ? "text-primary-foreground" : "text-foreground"
              )}
            >
              {title}
            </Title>
            {desc && (
              <p
                data-slot="frame-description"
                className={cn("text-sm leading-[18px]", staff ? "text-primary-foreground/80" : "text-muted-foreground")}
              >
                {desc}
              </p>
            )}
          </div>
          {hasActions && (
            <div
              data-slot="frame-actions"
              // A table toolbar spreads its controls and search across the header on a phone.
              className={cn(
                "flex max-w-full shrink-0 items-center gap-1 max-sm:has-[[role=toolbar]]:contents",
                staff &&
                  "[&_[data-slot=button]]:text-primary-foreground [&_[data-slot=button]]:hover:bg-primary-foreground/15 [&_[data-slot=button]]:active:bg-primary-foreground/25"
              )}
            >
              {actionNode}
              {actionList && <FrameActionList actions={actionList} limit={href ? 1 : FRAME_ACTION_LIMIT} />}
              {href && <FrameAction href={href}>{hrefLabel}</FrameAction>}
            </div>
          )}
        </header>
      )}
      <div
        data-slot="frame-content"
        className={cn(
          "relative flex-1 overflow-clip rounded-frame bg-background text-foreground shadow-surface",
          padded && "p-5",
          contentClassName
        )}
      >
        <InsideFrameContext.Provider value>{children}</InsideFrameContext.Provider>
      </div>
      {footer && (
        <footer
          data-slot="frame-footer"
          className={cn(
            "flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-1.5 text-sm",
            staff ? "text-primary-foreground/80" : "text-muted-foreground",
            "max-sm:justify-center"
          )}
        >
          {footer}
        </footer>
      )}
    </section>
  )
}

function FrameActionList({ actions, limit }) {
  const folds = actions.length > limit
  const shown = folds ? actions.slice(0, limit) : actions
  const folded = folds ? actions.slice(limit) : []

  return (
    <>
      {shown.map((item) => (
        <FrameAction key={item.label} href={item.href} icon={item.icon} onClick={item.onClick} disabled={item.disabled}>
          {item.label}
        </FrameAction>
      ))}
      {folded.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {folded.map((item) => (
              <DropdownMenuItem
                key={item.label}
                disabled={item.disabled}
                variant={item.destructive ? "destructive" : "default"}
                onSelect={item.onClick}
                asChild={Boolean(item.href)}
              >
                {item.href ? (
                  <Link href={item.href}>
                    {item.icon && <item.icon aria-hidden />}
                    {item.label}
                  </Link>
                ) : (
                  <>
                    {item.icon && <item.icon aria-hidden />}
                    {item.label}
                  </>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  )
}

/**
 * The one look for a button or link in a frame header or footer: a ghost `sm` button in ink. A
 * link ends in an arrow; a verb can lead with an icon.
 *
 * @param {object} props
 * @param {string} [props.href]
 * @param {React.ElementType} [props.icon]
 * @param {() => void} [props.onClick]
 * @param {boolean} [props.disabled]
 */
function FrameAction({ children, href, icon: Icon, onClick, disabled, className }) {
  const classes = cn("px-2 text-foreground", className)
  const body = (
    <>
      {Icon && <Icon aria-hidden className="size-4" />}
      {children}
      {href && <ArrowRight aria-hidden className="size-4" />}
    </>
  )
  if (href) {
    return (
      <Button asChild variant="ghost" size="sm" className={classes}>
        <Link href={href}>
          {body}
        </Link>
      </Button>
    )
  }
  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={disabled} className={classes}>
      {body}
    </Button>
  )
}

/**
 * The surface without a frame, for inside a dialog or sheet where the overlay already is the
 * frame. An optional 14/500 label sits above it.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.label]
 * @param {boolean} [props.padded=false]
 */
function FrameSurface({ label, padded = false, className, children, ...props }) {
  const labelId = React.useId()
  const surface = (
    <div
      data-ds="frame-surface"
      data-slot="frame-surface"
      aria-labelledby={label ? labelId : undefined}
      role={label ? "group" : undefined}
      className={cn(
        "overflow-clip rounded-control bg-background text-foreground shadow-surface",
        padded && "p-5",
        className
      )}
      {...props}
    >
      <InsideFrameContext.Provider value>{children}</InsideFrameContext.Provider>
    </div>
  )

  if (!label) return surface

  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-sm leading-[18px] font-medium text-foreground">
        {label}
      </p>
      {surface}
    </div>
  )
}

export { FRAME_ACTION_LIMIT, Frame, FrameAction, FrameSurface, InsideFrameContext, useInsideFrame }
