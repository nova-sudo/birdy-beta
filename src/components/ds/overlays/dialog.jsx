"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva } from "class-variance-authority"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "../primitives/button"

function Dialog(props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal(props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose(props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

/** Enter 200ms, exit 140ms, nothing under reduced motion. Shared by the scrim and every overlay. */
const OVERLAY_MOTION =
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200 data-[state=open]:ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-[140ms] data-[state=closed]:ease-out motion-reduce:animate-none"

/**
 * The flush white surface inside a dialog or sheet: r16, 20 of padding, 16 between children. It
 * scrolls when the content outgrows the screen, so the header and footer strips stay put.
 */
const OVERLAY_SURFACE =
  "relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain rounded-frame bg-background p-5 text-foreground shadow-surface"

/** The footer strip of a dialog or sheet: 64 tall, actions right aligned 8 apart. */
const OVERLAY_FOOTER = "flex min-h-16 shrink-0 flex-wrap items-center justify-end gap-2 px-4 py-3"

function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 z-50 bg-scrim", OVERLAY_MOTION, className)}
      {...props}
    />
  )
}

/**
 * The frame's width: 400 confirm and danger, 520 short form, 720 long form, 880 tabbed, 1120 the
 * widest builders.
 */
const dialogFrameVariants = cva(
  "flex max-h-[calc(100dvh-3rem)] max-w-[calc(100vw-2rem-14px)] flex-col overflow-clip rounded-overlay bg-frame font-sans text-foreground shadow-overlay-frame [&>:not([data-slot])]:flex [&>:not([data-slot])]:min-h-0 [&>:not([data-slot])]:flex-col",
  {
    variants: {
      size: {
        sm: "w-[400px]",
        md: "w-[520px]",
        lg: "w-[720px]",
        xl: "w-[880px]",
        "2xl": "w-[1120px]",
      },
    },
    defaultVariants: { size: "md" },
  }
)

/**
 * The translucent glass bezel every centred dialog sits in: 7 of padding round the frame.
 * Exported with `DialogFrame` so a static picture of a dialog draws the same thing.
 */
function DialogBezel({ className, ...props }) {
  return <div data-slot="dialog-bezel" className={cn("flex rounded-bezel bg-bezel p-[7px] shadow-bezel", className)} {...props} />
}

/**
 * The muted frame inside the bezel: header strip, flush surface, footer strip.
 * @param {object} props
 * @param {"sm"|"md"|"lg"|"xl"|"2xl"} [props.size="md"]
 */
function DialogFrame({ size, className, ...props }) {
  return (
    <div
      data-slot="dialog-frame"
      data-size={size ?? "md"}
      className={cn(dialogFrameVariants({ size }), className)}
      {...props}
    />
  )
}

/** The ghost close, 40 with a 20 icon, top right of the header strip. */
function DialogCloseButton({ className }) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close-button"
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "absolute top-2 right-2 text-muted-foreground hover:text-foreground [&_svg]:size-5",
        className
      )}
    >
      <XIcon aria-hidden />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  )
}

// Fragments are opened so a conditional `<>…<Footer/></>` still puts its footer in the strip.
function flatten(children, prefix = "") {
  return React.Children.toArray(children).flatMap((child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return flatten(child.props.children, `${prefix}${child.key}/`)
    }
    return React.isValidElement(child) && prefix ? [React.cloneElement(child, { key: `${prefix}${child.key}` })] : [child]
  })
}

/**
 * Birdy addition, so callers written before the frame keep rendering: when a dialog or sheet has
 * a header or footer strip and no body of its own, the loose children between the strips are
 * gathered into the body. A child that names its own `data-slot` is left on the frame as it is.
 */
function gatherBody(children, { Header, Footer, Body }) {
  const items = flatten(children)
  const isStrip = (c) => React.isValidElement(c) && (c.type === Header || c.type === Footer)
  const isBody = (c) => React.isValidElement(c) && c.type === Body
  if (!items.some(isStrip) || items.some(isBody)) return children

  const out = []
  let run = []
  const flush = () => {
    if (run.length) out.push(<Body key={`gathered-body-${out.length}`}>{run}</Body>)
    run = []
  }
  for (const c of items) {
    if (isStrip(c) || (React.isValidElement(c) && c.props?.["data-slot"] != null)) {
      flush()
      out.push(c)
    } else {
      run.push(c)
    }
  }
  flush()
  return out
}

/**
 * @param {object} props
 * @param {"sm"|"md"|"lg"|"xl"|"2xl"} [props.size="md"] `sm` 400, `md` 520, `lg` 720, `xl` 880, `2xl` 1120.
 * @param {boolean} [props.hideCloseButton=false]
 * @param {boolean} [props.showCloseButton] Older spelling; `false` hides the close.
 * @param {string} [props.className] Goes on the frame.
 */
function DialogContent({ className, children, size = "md", hideCloseButton = false, showCloseButton, ...props }) {
  const hideClose = hideCloseButton || showCloseButton === false
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content asChild {...props}>
        <DialogBezel
          data-ds="dialog"
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none",
            OVERLAY_MOTION,
            "data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:zoom-out-[0.98] data-[state=closed]:slide-out-to-bottom-2"
          )}
        >
          <DialogFrame size={size} className={cn("relative", className)}>
            {gatherBody(children, { Header: DialogHeader, Footer: DialogFooter, Body: DialogBody })}
            {/* After the content, so focus lands on the first field rather than on the close. */}
            {!hideClose && <DialogCloseButton />}
          </DialogFrame>
        </DialogBezel>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/** The header strip: title 18/600 and an optional 14 description, room on the right for the close. */
function DialogHeader({ className, ...props }) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 flex-col gap-1 pt-4 pr-14 pb-3.5 pl-5 text-left", className)}
      {...props}
    />
  )
}

/** The surface that holds the dialog's content. */
function DialogBody({ className, ...props }) {
  return <div data-slot="dialog-body" className={cn(OVERLAY_SURFACE, className)} {...props} />
}

function DialogFooter({ className, ...props }) {
  return <div data-slot="dialog-footer" className={cn(OVERLAY_FOOTER, className)} {...props} />
}

function DialogTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-6 font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm leading-[18px] text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBezel,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFrame,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  OVERLAY_FOOTER,
  OVERLAY_MOTION,
  OVERLAY_SURFACE,
  dialogFrameVariants,
  gatherBody,
}
