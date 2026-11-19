"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";
import { SELECTION } from "./motion";

// A centred dialog: header, scrolling body, footer strip. Radix keeps focus
// inside it, closes it on Escape and returns focus to whatever opened it.

/** Takes Radix Dialog props: `open`, `onOpenChange`. */
export const Dialog = DialogPrimitive.Root;

const SIZES = { md: "max-w-[37.5rem]", xl: "max-w-[65rem]" };

/**
 * @param {string} props.title shown in the header and read as the dialog's name
 * @param {React.ReactNode} [props.description] a quieter line under the title
 * @param {"md"|"xl"} [props.size] 600px for forms and steps, 1040px for tables
 * @param {React.ReactNode} [props.headerAside] sits between the title and the close button
 * @param {React.ReactNode} props.children usually DialogBody then DialogFooter
 */
export function DialogContent({ title, description, size = "md", headerAside, className, children, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-by-text/30 motion-safe:animate-[by-fade_var(--by-dur-fast)_var(--by-ease-out)]" />
      <DialogPrimitive.Content
        // The description is optional; without one, tell Radix not to expect it.
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-3rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
          "rounded-by-xl bg-by-surface font-by-body text-by-body text-by-text shadow-by-dialog outline-none",
          "motion-safe:animate-[by-dialog_var(--by-dur-base)_var(--by-ease-spring)]",
          SELECTION,
          SIZES[size] ?? SIZES.md,
          className,
        )}
        {...props}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-by-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="truncate font-by-display text-by-heading font-semibold">{title}</DialogPrimitive.Title>
            {description && <DialogPrimitive.Description className="mt-0.5 text-by-body-sm text-by-muted">{description}</DialogPrimitive.Description>}
          </div>
          {headerAside}
          <DialogPrimitive.Close asChild>
            <Button kind="ghost" size="sm" iconOnly aria-label="Close"><X aria-hidden="true" /></Button>
          </DialogPrimitive.Close>
        </header>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** The scrolling middle of a dialog. */
export function DialogBody({ className, ...props }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4.5", className)} {...props} />;
}

/** The strip of actions along the bottom of a dialog. */
export function DialogFooter({ className, ...props }) {
  return <footer className={cn("flex shrink-0 items-center gap-2 border-t border-by-line bg-by-canvas px-5 py-3.5", className)} {...props} />;
}
