"use client"

import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"
import { Button } from "../primitives/button"
import { DialogBezel, DialogFrame, OVERLAY_FOOTER, OVERLAY_MOTION, OVERLAY_SURFACE } from "./dialog"

// Module-level store: confirm() pushes a request, <ConfirmHost/> renders the head of the queue.
let queue = []
let hosts = 0
const listeners = new Set()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getHead = () => queue[0] ?? null

/**
 * Imperative confirmation. Resolves true on confirm, false on cancel or Escape.
 * Rejects if no <ConfirmHost/> is mounted.
 * @param {object} options
 * @param {string} options.title
 * @param {React.ReactNode} [options.description]
 * @param {string} [options.confirmLabel="Confirm"]
 * @param {string} [options.cancelLabel="Cancel"]
 * @param {"danger"|"default"} [options.tone="danger"] danger renders a destructive confirm button
 * @returns {Promise<boolean>}
 */
function confirm({ title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "danger" }) {
  if (hosts === 0) {
    return Promise.reject(new Error("confirm() called with no <ConfirmHost/> mounted. Mount it once in the layout."))
  }
  return new Promise((resolve) => {
    queue = [...queue, { title, description, confirmLabel, cancelLabel, tone, resolve }]
    emit()
  })
}

function settle(request, value) {
  request.resolve(value)
  queue = queue.filter((r) => r !== request)
  emit()
}

// Same snapshot every call until the queue changes, so useSyncExternalStore stays stable.
function ConfirmHost() {
  const request = React.useSyncExternalStore(subscribe, getHead, () => null)

  React.useEffect(() => {
    hosts += 1
    return () => {
      hosts -= 1
      if (hosts === 0) {
        // Nobody left to answer: cancel anything pending rather than hang it.
        queue.forEach((r) => r.resolve(false))
        queue = []
      }
    }
  }, [])

  return (
    <AlertDialogPrimitive.Root
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && request) settle(request, false)
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          data-slot="confirm-overlay"
          className={cn("fixed inset-0 z-50 bg-scrim", OVERLAY_MOTION)}
        />
        {/* The dialog's bezel and 400 frame: the question on the white surface, the answers in the footer strip. */}
        <AlertDialogPrimitive.Content asChild>
          <DialogBezel
            data-ds="confirm"
            data-slot="confirm-content"
            className={cn(
              "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none",
              OVERLAY_MOTION,
              "data-[state=open]:zoom-in-[0.98] data-[state=closed]:zoom-out-[0.98]"
            )}
          >
            <DialogFrame size="sm">
              {request && (
                <>
                  <div data-slot="confirm-surface" className={cn(OVERLAY_SURFACE, "gap-1.5 p-6")}>
                    <AlertDialogPrimitive.Title className="text-lg leading-6 font-semibold text-foreground">
                      {request.title}
                    </AlertDialogPrimitive.Title>
                    <AlertDialogPrimitive.Description className="text-base leading-[22px] text-neutral">
                      {request.description}
                    </AlertDialogPrimitive.Description>
                  </div>
                  <div data-slot="confirm-footer" className={OVERLAY_FOOTER}>
                    <AlertDialogPrimitive.Cancel asChild>
                      <Button variant="outline" onClick={() => settle(request, false)}>
                        {request.cancelLabel}
                      </Button>
                    </AlertDialogPrimitive.Cancel>
                    <AlertDialogPrimitive.Action asChild>
                      <Button
                        variant={request.tone === "danger" ? "destructive" : "primary"}
                        onClick={() => settle(request, true)}
                      >
                        {request.confirmLabel}
                      </Button>
                    </AlertDialogPrimitive.Action>
                  </div>
                </>
              )}
            </DialogFrame>
          </DialogBezel>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

export { confirm, ConfirmHost }
