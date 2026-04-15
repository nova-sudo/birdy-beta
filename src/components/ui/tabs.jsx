"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col", className)}
      {...props} />
  );
}

function TabsList({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative z-0 flex w-fit items-center justify-center gap-x-0.5 rounded-xl bg-muted p-1.5 text-muted-foreground/72 data-[orientation=vertical]:flex-col data-[orientation=vertical]:px-1 data-[orientation=horizontal]:py-1",
        className
      )}
      {...props} />
  );
}

function TabsTrigger({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "[&_svg]:-mx-0.5 flex shrink-0 grow cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-base outline-none transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "text-muted-foreground hover:text-foreground/80 data-[state=active]:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm",
        "h-9 gap-1.5 px-2.5 sm:h-8",
        "data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start",
        className
      )}
      {...props} />
  );
}

function TabsContent({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}

    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
