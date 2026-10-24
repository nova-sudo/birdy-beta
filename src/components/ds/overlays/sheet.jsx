"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

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

function SheetOverlay({ className, ...props }) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200 motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

// 320ms on ease-edge for the slide; reduced motion drops the animation.
const SIDES = {
  right:
    "inset-y-0 right-0 h-full w-3/4 sm:max-w-sm data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  left:
    "inset-y-0 left-0 h-full w-3/4 sm:max-w-sm data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  bottom:
    "inset-x-0 bottom-0 h-auto max-h-[85dvh] rounded-t-overlay data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
}

/**
 * @param {object} props
 * @param {"right"|"bottom"|"left"} [props.side="right"] Edge the sheet slides in from. Below 768px `right` renders as `bottom`.
 */
function SheetContent({ className, children, side = "right", ...props }) {
  const narrow = useNarrow()
  const resolved = side === "right" && narrow ? "bottom" : side

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-ds="sheet"
        data-slot="sheet-content"
        data-side={resolved}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background font-sans text-foreground shadow-overlay outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-[320ms] data-[state=closed]:duration-200 ease-edge motion-reduce:animate-none",
          SIDES[resolved],
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-control text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:shadow-control-focus disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />
}

function SheetFooter({ className, ...props }) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
}

function SheetTitle({ className, ...props }) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
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
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
