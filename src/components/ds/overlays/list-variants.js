"use client"

import * as React from "react"
import { cva } from "class-variance-authority"

/**
 * Open lists (select, menu, command, combobox) follow the trigger that opened them: an `md`
 * trigger or button opens 40-tall rows with a 16 label, an `sm` one 32-tall rows with a 14 label,
 * so the text in the list never reads smaller than the text on the trigger. `lg` rows (48 tall,
 * 20 icons) are for lists that open as a phone sheet.
 *
 * @typedef {"sm"|"md"|"lg"} ListSize
 */

/**
 * The list size a trigger of this field or button size opens. `lg` triggers open `md` rows.
 * @param {string|null|undefined} size
 * @returns {ListSize}
 */
export function listSizeFor(size) {
  return size === "sm" || size === "icon-sm" ? "sm" : "md"
}

export const ListSizeContext = React.createContext(/** @type {ListSize} */ ("md"))

/**
 * The row size for a list part: its own `size` when given, else the list's.
 * @param {ListSize} [size]
 * @returns {ListSize}
 */
export function useListSize(size) {
  const inherited = React.useContext(ListSizeContext)
  return size ?? inherited
}

export const LIST_SURFACE =
  "z-50 rounded-control-lg bg-popover p-1.5 font-sans text-popover-foreground shadow-floating outline-none"

/** Fade and drop 4px toward the trigger's far side in 200ms; leave in 140ms. */
export const LIST_MOTION =
  "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:[animation-duration:200ms] motion-safe:data-[state=open]:[animation-timing-function:cubic-bezier(0,0,0.2,1)] motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:[animation-duration:140ms] motion-safe:data-[side=bottom]:slide-in-from-top-1 motion-safe:data-[side=top]:slide-in-from-bottom-1 motion-safe:data-[side=left]:slide-in-from-right-1 motion-safe:data-[side=right]:slide-in-from-left-1"

/**
 * One row. The highlighted row (Radix `data-highlighted`, cmdk `data-selected`) is a muted pill;
 * plain buttons add `LIST_ITEM_HOVER` for the same pill on hover and keyboard focus.
 */
export const listItemVariants = cva(
  [
    "relative flex w-full cursor-pointer items-center text-left text-foreground outline-hidden select-none",
    "data-highlighted:bg-muted data-[selected=true]:bg-muted",
    // Radix marks a disabled row `data-disabled=""`; cmdk writes `data-disabled` on every row,
    // "true" or "false", so "false" must not read as disabled.
    "aria-disabled:pointer-events-none aria-disabled:cursor-default aria-disabled:text-muted-foreground disabled:pointer-events-none disabled:text-muted-foreground not-data-[disabled=false]:data-[disabled]:pointer-events-none not-data-[disabled=false]:data-[disabled]:text-muted-foreground",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='text-'])]:text-muted-foreground",
    "data-[variant=destructive]:text-menu-destructive data-[variant=destructive]:[&_svg]:text-menu-destructive",
  ],
  {
    variants: {
      size: {
        md: "min-h-10 gap-2.5 rounded-control-sm px-3 py-2 text-base [&_svg:not([class*='size-'])]:size-[18px]",
        sm: "min-h-8 gap-2 rounded-md px-2.5 py-1.5 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "min-h-12 gap-3 rounded-control px-3 py-2.5 text-base [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: { size: "md" },
  }
)

export const LIST_ITEM_HOVER = "hover:bg-muted focus-visible:bg-muted"

/** A second line under a row's label. */
export const LIST_DESCRIPTION = {
  lg: "text-sm text-muted-foreground",
  md: "text-sm text-muted-foreground",
  sm: "text-xs text-muted-foreground",
}

/** Group labels are 13/500 muted at both sizes, inset to line up with the row labels. */
export const LIST_LABEL = {
  lg: "px-3 pt-2.5 pb-1 text-xs font-medium text-muted-foreground",
  md: "px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground",
  sm: "px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground",
}

/** Separators run edge to edge through the surface's 6px padding. */
export const LIST_SEPARATOR = "pointer-events-none -mx-1.5 my-1.5 h-px bg-divider"

/** The search row on top of a long list, a hairline under it. */
export const LIST_SEARCH = {
  lg: "h-12 gap-3 px-3 text-base [&_svg:not([class*='size-'])]:size-5",
  md: "h-11 gap-2.5 px-3 text-base [&_svg:not([class*='size-'])]:size-[18px]",
  sm: "h-9 gap-2 px-2.5 text-sm [&_svg:not([class*='size-'])]:size-4",
}

export const LIST_EMPTY = "py-6 text-center text-sm text-muted-foreground"

/** The check or indicator slot at a row's right, the size of the row's icons. */
export const LIST_CHECK_SIZE = {
  lg: "size-5",
  md: "size-[18px]",
  sm: "size-4",
}
