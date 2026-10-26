"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog"
import {
  LIST_EMPTY,
  LIST_SEARCH,
  LIST_SEPARATOR,
  ListSizeContext,
  listItemVariants,
  useListSize,
} from "./list-variants"

/**
 * @param {object} props
 * @param {"sm"|"md"|"lg"} [props.size="md"] Follows the trigger that opened the list: `sm` beside `sm` buttons, else `md`.
 */
function Command({ className, size = "md", ...props }) {
  return (
    <ListSizeContext.Provider value={size}>
      <CommandPrimitive
        data-ds="command"
        data-slot="command"
        data-size={size}
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-[inherit] bg-popover font-sans text-popover-foreground",
          className
        )}
        {...props}
      />
    </ListSizeContext.Provider>
  )
}

/**
 * The command palette: a 640 dialog with a 56 input row and an optional footer strip of keyboard
 * hints.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.footer] The strip under the list, for keyboard hints.
 * @param {boolean} [props.shouldFilter] Off when the caller ranks and filters the items itself.
 */
function CommandDialog({
  title = "Command palette",
  description = "Search for a command to run",
  shouldFilter,
  footer,
  children,
  className,
  ...props
}) {
  return (
    <Dialog {...props}>
      <DialogContent className={cn("w-[640px]", className)} hideCloseButton>
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="gap-0 p-0">
          <Command
            shouldFilter={shouldFilter}
            className="**:data-[slot=command-input]:text-lg **:data-[slot=command-input-wrapper]:h-14"
          >
            {children}
          </Command>
        </DialogBody>
        {footer && (
          <div data-slot="command-footer" className="flex h-11 shrink-0 items-center gap-4 px-4 text-xs text-muted-foreground">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * @param {object} props
 * @param {React.ReactNode} [props.trailing] After the field, inside the row: an esc keycap, say.
 */
function CommandInput({ className, trailing, ...props }) {
  const size = useListSize()
  return (
    <div
      data-slot="command-input-wrapper"
      className={cn("flex shrink-0 items-center border-b border-divider text-muted-foreground", LIST_SEARCH[size])}
    >
      <SearchIcon />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-full w-full min-w-0 bg-transparent text-foreground outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      {trailing}
    </div>
  )
}

/** 300 tall in a popover or dialog. */
function CommandList({ className, ...props }) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("max-h-[300px] scroll-py-1.5 overflow-x-hidden overflow-y-auto p-1.5", className)}
      {...props}
    />
  )
}

function CommandEmpty({ className, ...props }) {
  return <CommandPrimitive.Empty data-slot="command-empty" className={cn(LIST_EMPTY, className)} {...props} />
}

const GROUP_HEADING = {
  lg: "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1",
  md: "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1",
  sm: "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1",
}

function CommandGroup({ className, ...props }) {
  const size = useListSize()
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden text-foreground [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        GROUP_HEADING[size],
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({ className, ...props }) {
  return <CommandPrimitive.Separator data-slot="command-separator" className={cn(LIST_SEPARATOR, className)} {...props} />
}

function CommandItem({ className, ...props }) {
  const size = useListSize()
  return <CommandPrimitive.Item data-slot="command-item" className={cn(listItemVariants({ size }), className)} {...props} />
}

function CommandShortcut({ className, ...props }) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
