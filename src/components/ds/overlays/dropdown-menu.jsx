"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { CheckIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Kbd, KbdShortcut } from "../primitives/kbd"
import {
  LIST_CHECK_SIZE,
  LIST_LABEL,
  LIST_MOTION,
  LIST_SEPARATOR,
  LIST_SURFACE,
  ListSizeContext,
  listItemVariants,
  useListSize,
} from "./list-variants"

function DropdownMenu(props) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal(props) {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger(props) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

const CONTENT_CLASSES = cn(
  LIST_SURFACE,
  "max-h-(--radix-dropdown-menu-content-available-height) min-w-[max(var(--radix-dropdown-menu-trigger-width),10rem)] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto"
)

/**
 * The menu, under its trigger.
 *
 * @param {object} props
 * @param {"sm"|"md"|"lg"} [props.size="md"] The rows' size. `sm` when the trigger is an `sm` or `icon-sm` button.
 * @param {HTMLElement|null} [props.container] Where to portal the menu. Defaults to `document.body`.
 */
function DropdownMenuContent({ className, size = "md", align = "start", sideOffset = 8, container, ...props }) {
  return (
    <DropdownMenuPrimitive.Portal container={container ?? undefined}>
      <ListSizeContext.Provider value={size}>
        <DropdownMenuPrimitive.Content
          data-ds="dropdown-menu"
          data-slot="dropdown-menu-content"
          data-size={size}
          align={align}
          sideOffset={sideOffset}
          className={cn(CONTENT_CLASSES, LIST_MOTION, className)}
          {...props}
        />
      </ListSizeContext.Provider>
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup(props) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

const INSET = { lg: "pl-11", md: "pl-[42px]", sm: "pl-8" }

/**
 * @param {object} props
 * @param {"default"|"destructive"} [props.variant="default"] Destructive rows are red, icon included, and sit last after a separator.
 * @param {boolean} [props.inset]
 */
function DropdownMenuItem({ className, inset, variant = "default", ...props }) {
  const size = useListSize()

  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(listItemVariants({ size }), inset && INSET[size], className)}
      {...props}
    />
  )
}

function ItemCheck() {
  const size = useListSize()

  return (
    <span className={cn("ml-auto flex shrink-0 items-center justify-center", LIST_CHECK_SIZE[size])}>
      <DropdownMenuPrimitive.ItemIndicator>
        <CheckIcon className="size-full text-foreground" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
  )
}

function DropdownMenuCheckboxItem({ className, children, ...props }) {
  const size = useListSize()

  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(listItemVariants({ size }), className)}
      {...props}
    >
      {children}
      <ItemCheck />
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup(props) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
}

function DropdownMenuRadioItem({ className, children, ...props }) {
  const size = useListSize()

  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(listItemVariants({ size }), className)}
      {...props}
    >
      {children}
      <ItemCheck />
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({ className, inset, ...props }) {
  const size = useListSize()

  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(LIST_LABEL[size], inset && INSET[size], className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(LIST_SEPARATOR, className)}
      {...props}
    />
  )
}

/**
 * A row's shortcut, as keycaps at its right.
 *
 * @param {object} props
 * @param {string[]} [props.keys] Read like `KbdShortcut`'s, e.g. `["mod", "k"]`. Without it, `children` is one cap.
 */
function DropdownMenuShortcut({ className, keys, children, ...props }) {
  return (
    <span data-slot="dropdown-menu-shortcut" className={cn("ml-auto flex shrink-0 items-center pl-3", className)} {...props}>
      {keys ? <KbdShortcut keys={keys} /> : <Kbd>{children}</Kbd>}
    </span>
  )
}

function DropdownMenuSub(props) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({ className, inset, children, ...props }) {
  const size = useListSize()

  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(listItemVariants({ size }), "data-[state=open]:bg-muted", inset && INSET[size], className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto text-muted-foreground" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({ className, sideOffset = 6, alignOffset = -6, container, ...props }) {
  return (
    <DropdownMenuPrimitive.Portal container={container ?? undefined}>
      <DropdownMenuPrimitive.SubContent
        data-slot="dropdown-menu-sub-content"
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className={cn(
          LIST_SURFACE,
          LIST_MOTION,
          "max-h-(--radix-dropdown-menu-content-available-height) min-w-40 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
