"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { DialogCloseButton, DialogOverlay, OVERLAY_FOOTER, OVERLAY_SURFACE, gatherBody } from "./dialog"

const NARROW = "(max-width: 767px)"

// Below 768px a right sheet becomes a bottom sheet. Server snapshot is false,
// so the first paint is the desktop layout and flips after hydration.
function useNarrow() {
  return React.useSyncExternalStore(
    (notify) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {}
      const mq = window.matchMedia(NARROW)
      mq.addEventListener("change", notify)
      return () => mq.removeEventListener("change", notify)
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(NARROW).matches : false),
    () => false
  )
}

function Sheet(props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal(props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

/**
 * A sheet is attached to the edge it comes from: no gap, rounded only on its free side, sliding in
 * from that edge in 200ms and out in 140ms. The right sheet is 440 wide (720 at `lg`), full height.
 */
const sheetVariants = cva(
  "fixed z-50 flex flex-col bg-frame font-sans text-foreground outline-none data-[state=open]:animate-in data-[state=open]:duration-200 data-[state=open]:ease-edge data-[state=closed]:animate-out data-[state=closed]:duration-[140ms] data-[state=closed]:ease-out motion-reduce:animate-none [&>:not([data-slot])]:flex [&>:not([data-slot])]:min-h-0 [&>:not([data-slot])]:flex-1 [&>:not([data-slot])]:flex-col",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full max-w-[calc(100vw-1rem)] rounded-l-overlay shadow-sheet data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
        left: "inset-y-0 left-0 h-full max-w-[calc(100vw-1rem)] rounded-r-overlay shadow-sheet-left data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
        bottom:
          "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-3xl shadow-sheet-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
        top: "inset-x-0 top-0 max-h-[90dvh] rounded-b-3xl shadow-sheet-top data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
      },
      size: {
        md: "",
        lg: "",
      },
    },
    compoundVariants: [
      { side: ["right", "left"], size: "md", className: "w-[440px]" },
      { side: ["right", "left"], size: "lg", className: "w-[720px]" },
    ],
    defaultVariants: { side: "right", size: "md" },
  }
)

/**
 * @param {object} props
 * @param {"right"|"left"|"bottom"|"top"} [props.side="right"] Edge the sheet slides in from. Below 768px `right` renders as `bottom`.
 * @param {"md"|"lg"} [props.size="md"] Width of a side sheet: 440 or 720.
 * @param {boolean} [props.hideCloseButton=false]
 */
function SheetContent({ className, children, side = "right", size = "md", hideCloseButton = false, ...props }) {
  const narrow = useNarrow()
  const resolved = side === "right" && narrow ? "bottom" : side

  return (
    <SheetPortal>
      <DialogOverlay data-slot="sheet-overlay" />
      <SheetPrimitive.Content
        data-ds="sheet"
        data-slot="sheet-content"
        data-side={resolved}
        className={cn(sheetVariants({ side: resolved, size }), className)}
        {...props}
      >
        {gatherBody(children, { Header: SheetHeader, Footer: SheetFooter, Body: SheetBody })}
        {!hideCloseButton && <DialogCloseButton className="top-2.5" />}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

/**
 * The header strip: an optional `leading` avatar, the title row, an optional line under it, and
 * `actions` (a ⋯ menu) just left of the close.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.leading]
 * @param {React.ReactNode} [props.actions]
 */
function SheetHeader({ className, children, leading, actions, ...props }) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex min-h-15 shrink-0 items-start gap-2 py-3.5 pr-13 pl-5", leading && "gap-3 pl-4", className)}
      {...props}
    >
      {leading && <div className="flex shrink-0 items-center self-center">{leading}</div>}
      <div className="flex min-h-8 min-w-0 flex-1 flex-col justify-center gap-1">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
    </div>
  )
}

/** The surface that holds the sheet's content. It scrolls; the header and footer stay put. */
function SheetBody({ className, ...props }) {
  return <div data-slot="sheet-body" className={cn(OVERLAY_SURFACE, className)} {...props} />
}

function SheetFooter({ className, ...props }) {
  return <div data-slot="sheet-footer" className={cn(OVERLAY_FOOTER, className)} {...props} />
}

function SheetTitle({ className, ...props }) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("truncate text-lg leading-6 font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm leading-[18px] text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  sheetVariants,
}
