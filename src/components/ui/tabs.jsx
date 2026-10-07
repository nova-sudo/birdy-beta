"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { EASE_SPRING } from "@/components/motion"

// The active tab's white pill is one element that slides between triggers
// (a shared layoutId), so each trigger has to know which value is active.
// Radix keeps that to itself, so Tabs mirrors it here — following `value`
// when the caller controls it, its own copy of `defaultValue` when not.
const TabsState = React.createContext(null)

function Tabs({
  className,
  value,
  defaultValue,
  onValueChange,
  ...props
}) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue)
  const active = value !== undefined ? value : uncontrolled
  const id = React.useId()

  const handleChange = React.useCallback((next) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }, [value, onValueChange])

  return (
    <TabsState.Provider value={{ active, id }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        className={cn("flex flex-col", className)}
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleChange}
        {...props} />
    </TabsState.Provider>
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
        "relative z-0 flex w-fit items-center justify-center gap-x-0.5 rounded-full bg-muted p-1 text-muted-foreground/72 data-[orientation=vertical]:flex-col data-[orientation=vertical]:rounded-2xl data-[orientation=vertical]:px-1",
        className
      )}
      {...props} />
  );
}

function TabsTrigger({
  className,
  value,
  children,
  ...props
}) {
  const state = React.useContext(TabsState)
  const isActive = state?.active === value

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      className={cn(
        "relative [&_svg]:-mx-0.5 flex shrink-0 grow cursor-pointer items-center justify-center whitespace-nowrap rounded-full border border-transparent font-medium text-base outline-none transition-colors duration-200 focus-visible:ring-4 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 sm:text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "text-muted-foreground hover:text-foreground/80 data-[state=active]:text-foreground",
        // Fallback for a trigger rendered outside <Tabs>, where there is no
        // shared pill to slide: paint the active state on the trigger itself.
        !state && "data-[state=active]:bg-background data-[state=active]:shadow-sm",
        "h-9 gap-1.5 px-3 sm:h-8",
        "data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start",
        className
      )}
      {...props}>
      {state && isActive && (
        <motion.span
          layoutId={`${state.id}-tab-pill`}
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-full bg-background shadow-sm"
          transition={{ duration: 0.5, ease: EASE_SPRING }}
        />
      )}
      {children}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 outline-none",
        "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-4 data-[state=active]:duration-500 data-[state=active]:ease-[cubic-bezier(.34,1.56,.64,1)] motion-reduce:animate-none",
        className
      )}
      {...props}

    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
