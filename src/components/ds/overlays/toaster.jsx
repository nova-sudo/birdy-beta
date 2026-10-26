"use client"

import { Toaster as Sonner, toast } from "sonner"

import { cn } from "@/lib/utils"

/**
 * Sonner with token classes. Light mode only, so no theme hook.
 * `toast` is re-exported so callers can import both from the ds barrel.
 */
function Toaster({ toastOptions, className, ...props }) {
  return (
    <div data-ds="toaster" className="contents">
      <Sonner
        theme="light"
        className={cn("toaster group", className)}
        toastOptions={{
          ...toastOptions,
          classNames: {
            toast:
              "group toast !rounded-surface !border-0 !bg-background !text-foreground !shadow-floating !font-sans",
            description: "!text-muted-foreground",
            actionButton: "!bg-primary !text-primary-foreground !rounded-control",
            cancelButton: "!bg-muted !text-foreground !rounded-control",
            ...toastOptions?.classNames,
          },
        }}
        {...props}
      />
    </div>
  )
}

export { Toaster, toast }
