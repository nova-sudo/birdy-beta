"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

/** Underline tabs: a hairline under the list, a primary bar under the active trigger. */
function Tabs({ className, ...props }) {
  return (
    <TabsPrimitive.Root
      data-ds="tabs"
      data-slot="tabs"
      className={cn("flex flex-col", className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex w-full items-center gap-5 border-b border-border", className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative -mb-px inline-flex h-control-sm shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-0.5 text-sm font-medium text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:shadow-control-focus focus-visible:rounded-sm disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 pt-4 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
