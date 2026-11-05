"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { triggerVariants } from "./field-variants"
import {
  LIST_CHECK_SIZE,
  LIST_DESCRIPTION,
  LIST_LABEL,
  LIST_MOTION,
  LIST_SEPARATOR,
  LIST_SURFACE,
  ListSizeContext,
  listItemVariants,
  listSizeFor,
  useListSize,
} from "../overlays/list-variants"

// `size` on the root reaches both the trigger and the list it opens: an `sm` trigger opens
// 32-tall rows with a 14 label, `md` and `lg` open 40-tall rows with a 16 label.
const SelectSizeContext = React.createContext("md")

/**
 * @param {object} props
 * @param {"sm"|"md"|"lg"} [props.size="md"] Read by the trigger and the list. A `size` on the trigger still wins for the trigger.
 */
function Select({ size = "md", ...props }) {
  return (
    <SelectSizeContext.Provider value={size}>
      <SelectPrimitive.Root data-slot="select" {...props} />
    </SelectSizeContext.Provider>
  )
}

function SelectGroup({ ...props }) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({ ...props }) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

/**
 * @param {{ size?: "default"|"md"|"sm"|"lg" }} props `default` is `md` (40). `sm` is 32 and `lg` is 48, matching the Button heights. Falls back to the root's `size`.
 */
function SelectTrigger({ className, size, children, ...props }) {
  const rootSize = React.useContext(SelectSizeContext)
  const resolved = !size || size === "default" ? rootSize : size
  return (
    <SelectPrimitive.Trigger
      data-ds="select"
      data-slot="select-trigger"
      data-size={resolved}
      className={cn(
        triggerVariants({ size: resolved }),
        "w-fit *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronsUpDownIcon />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

/**
 * The list, under the trigger.
 *
 * @param {object} props
 * @param {"sm"|"md"|"lg"} [props.size] Row size. Defaults to what the root's `size` opens.
 */
function SelectContent({ className, children, position = "popper", align = "center", sideOffset = 8, size, ...props }) {
  const rootSize = React.useContext(SelectSizeContext)
  const rows = size ?? listSizeFor(rootSize)
  const popper = position === "popper"
  return (
    <SelectPrimitive.Portal>
      <ListSizeContext.Provider value={rows}>
        <SelectPrimitive.Content
          data-ds="select-content"
          data-slot="select-content"
          data-size={rows}
          className={cn(
            LIST_SURFACE,
            LIST_MOTION,
            "relative flex max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) flex-col overflow-hidden p-0",
            className
          )}
          position={position}
          align={align}
          sideOffset={popper ? sideOffset : undefined}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.Viewport
            className={cn(
              "p-1.5",
              popper && "h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width) scroll-my-1.5"
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
          <SelectScrollDownButton />
        </SelectPrimitive.Content>
      </ListSizeContext.Provider>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }) {
  const size = useListSize()
  return <SelectPrimitive.Label data-slot="select-label" className={cn(LIST_LABEL[size], className)} {...props} />
}

// Radix's ItemText drops `className`, so the row lays it out from outside: it is the one span in
// the row with an id.
const ITEM_TEXT = {
  sm: "[&_span[id]]:flex [&_span[id]]:min-w-0 [&_span[id]]:items-center [&_span[id]]:gap-2",
  md: "[&_span[id]]:flex [&_span[id]]:min-w-0 [&_span[id]]:items-center [&_span[id]]:gap-2.5",
  lg: "[&_span[id]]:flex [&_span[id]]:min-w-0 [&_span[id]]:items-center [&_span[id]]:gap-3",
}

/**
 * `description` and `aside` sit beside `ItemText`, not in it: Radix clones only the chosen item's
 * `ItemText` into the trigger, so anything inside it would show in the closed control too.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.description] A second line under the label.
 * @param {React.ReactNode} [props.aside] A short tag or a disabled option's reason at the right.
 */
function SelectItem({ className, children, description, aside, ...props }) {
  const size = useListSize()
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(listItemVariants({ size }), ITEM_TEXT[size], className)}
      {...props}
    >
      {description ? (
        <div className="flex min-w-0 flex-col items-start">
          <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
          <span className={cn("text-start whitespace-pre-wrap", LIST_DESCRIPTION[size])}>{description}</span>
        </div>
      ) : (
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {aside && (
          <span data-slot="select-item-aside" className={LIST_DESCRIPTION[size]}>
            {aside}
          </span>
        )}
        <span className={cn("flex items-center justify-center", LIST_CHECK_SIZE[size])}>
          <SelectPrimitive.ItemIndicator>
            <CheckIcon className="size-full text-foreground" />
          </SelectPrimitive.ItemIndicator>
        </span>
      </span>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }) {
  return <SelectPrimitive.Separator data-slot="select-separator" className={cn(LIST_SEPARATOR, className)} {...props} />
}

function SelectScrollUpButton({ className, ...props }) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn("flex h-7 shrink-0 cursor-default items-center justify-center text-muted-foreground", className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({ className, ...props }) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn("flex h-7 shrink-0 cursor-default items-center justify-center text-muted-foreground", className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
