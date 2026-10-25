"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ds/overlays/tooltip"

const TabsContext = React.createContext(null)
const TabsListContext = React.createContext({ variant: "framed", size: "md" })

/**
 * Controlled when `value` is given, uncontrolled otherwise. The triggers and the thumb both read the
 * current value from context.
 *
 * @param {object} props
 * @param {string} [props.value]
 * @param {string} [props.defaultValue]
 * @param {(value: string) => void} [props.onValueChange]
 */
function Tabs({ className, value, defaultValue, onValueChange, ...props }) {
  const [inner, setInner] = React.useState(defaultValue)
  const current = value !== undefined ? value : inner
  const setCurrent = React.useCallback(
    (next) => {
      setInner(next)
      onValueChange?.(next)
    },
    [onValueChange]
  )
  const context = React.useMemo(() => ({ value: current, setValue: setCurrent }), [current, setCurrent])

  return (
    <TabsContext.Provider value={context}>
      <TabsPrimitive.Root
        data-ds="tabs"
        data-slot="tabs"
        value={current}
        onValueChange={setCurrent}
        className={cn("flex flex-col gap-2 data-[orientation=vertical]:flex-row", className)}
        {...props}
      />
    </TabsContext.Provider>
  )
}

const RAIL_CLASSES = {
  md: "min-h-10 rounded-control",
  sm: "min-h-8 rounded-control-sm",
}

/**
 * The thumb is one element measured onto the active tab rather than a background on the tab
 * itself, so it can slide between tabs (280ms on ease-thumb), squash while any tab is held, and
 * bump once as it lands. Chips have no thumb: the chosen chip is inverse in place.
 *
 * @param {object} props
 * @param {"framed"|"underline"|"chips"} [props.variant="framed"]
 * @param {"sm"|"md"} [props.size="md"]
 * @param {"surface"|"frame"} [props.surface="surface"] What the rail sits on: a white surface, or the muted frame (sidebar, panel headers)
 * @param {boolean} [props.fill=false] Framed only: the rail takes the full width and every tab gets an equal share
 */
function TabsList({
  variant = "framed",
  size = "md",
  surface = "surface",
  fill = false,
  className,
  children,
  onPointerDown,
  ...props
}) {
  const tabs = React.useContext(TabsContext)
  const listRef = React.useRef(null)
  const [rect, setRect] = React.useState(null)
  const [ready, setReady] = React.useState(false)
  const [held, setHeld] = React.useState(false)
  const [landing, setLanding] = React.useState(false)
  const hasThumb = variant !== "chips"

  const measure = React.useCallback(() => {
    const active = listRef.current?.querySelector("[role=tab][data-state=active]")
    if (!active) {
      setRect(null)
      return
    }
    setRect((previous) => {
      const next = {
        left: active.offsetLeft,
        top: active.offsetTop,
        width: active.offsetWidth,
        height: active.offsetHeight,
      }
      return previous &&
        previous.left === next.left &&
        previous.top === next.top &&
        previous.width === next.width &&
        previous.height === next.height
        ? previous
        : next
    })
  }, [])

  React.useLayoutEffect(() => {
    if (hasThumb) measure()
  }, [hasThumb, measure, tabs?.value, children, size])

  React.useEffect(() => {
    const el = listRef.current
    if (!hasThumb || !el || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasThumb, measure])

  // The first position is placed, not slid in from the corner.
  React.useEffect(() => {
    if (!rect || ready) return
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [rect, ready])

  React.useEffect(() => {
    if (!held) return
    const release = () => setHeld(false)
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
    return () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
    }
  }, [held])

  const list = (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      data-variant={variant}
      data-size={size}
      data-fill={(variant === "framed" && fill) || undefined}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        const tab = event.target.closest?.("[role=tab]")
        if (tab && !tab.hasAttribute("disabled") && event.button === 0) setHeld(true)
      }}
      className={cn(
        "relative isolate text-muted-foreground",
        variant === "framed" &&
          cn(
            "grid min-w-max grid-flow-col",
            fill ? "w-full auto-cols-fr" : "w-fit auto-cols-auto",
            RAIL_CLASSES[size],
            surface === "frame" ? "bg-rail-frame" : "bg-rail"
          ),
        variant === "underline" &&
          cn("flex w-full items-stretch border-b border-border", size === "md" ? "gap-6" : "gap-4"),
        variant === "chips" && "flex flex-wrap items-center gap-2",
        "data-[orientation=vertical]:min-w-0 data-[orientation=vertical]:grid-flow-row",
        className
      )}
      {...props}
    >
      {hasThumb && rect && (
        <span
          aria-hidden
          data-slot="tabs-thumb"
          data-held={held || undefined}
          data-landing={landing || undefined}
          onTransitionEnd={(event) => {
            if (variant === "framed" && (event.propertyName === "left" || event.propertyName === "width"))
              setLanding(true)
          }}
          onAnimationEnd={() => setLanding(false)}
          style={
            variant === "underline"
              ? { left: rect.left, width: rect.width }
              : { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
          }
          className={cn(
            "pointer-events-none absolute -z-10",
            variant === "framed"
              ? cn("bg-tab-thumb shadow-control", RAIL_CLASSES[size])
              : "-bottom-px h-0.5 rounded-full bg-foreground",
            ready &&
              "motion-safe:transition-[left,top,width,height,scale] motion-safe:duration-280 motion-safe:ease-thumb",
            "motion-safe:data-[held]:scale-x-97 motion-safe:data-[held]:scale-y-90 motion-safe:data-[held]:duration-120 motion-safe:data-[held]:ease-press",
            "motion-safe:data-[landing]:animate-tab-land"
          )}
        />
      )}
      {children}
    </TabsPrimitive.List>
  )

  return (
    <TabsListContext.Provider value={{ variant, size }}>
      {variant === "chips" ? (
        list
      ) : (
        // Tabs never shrink below their labels: short of room, the rail scrolls sideways. A scroll
        // box clips both axes, so the padding gives the thumb's ring room and the negative margin
        // takes it back out of the layout.
        <div
          data-slot="tabs-scroller"
          className="-m-1 max-w-[calc(100%+0.5rem)] min-w-0 overflow-x-auto p-1 [scrollbar-width:none] has-[[data-orientation=vertical]]:m-0 has-[[data-orientation=vertical]]:overflow-visible has-[[data-orientation=vertical]]:p-0 [&::-webkit-scrollbar]:hidden"
        >
          {list}
        </div>
      )}
    </TabsListContext.Provider>
  )
}

const TRIGGER_SIZE = {
  framed: {
    md: "min-h-10 min-w-20 gap-2 data-[count]:min-w-28 rounded-control px-[18px] text-base [&_svg:not([class*=size-])]:size-[18px]",
    sm: "min-h-8 min-w-16 gap-1.5 rounded-control-sm px-3 data-[count]:min-w-22 text-sm [&_svg:not([class*=size-])]:size-4",
  },
  underline: {
    md: "min-h-10 gap-2 text-base [&_svg:not([class*=size-])]:size-[18px]",
    sm: "min-h-8 gap-1.5 text-sm [&_svg:not([class*=size-])]:size-4",
  },
  chips: {
    md: "h-8 gap-1.5 rounded-full px-3 text-sm [&_svg:not([class*=size-])]:size-4",
    sm: "h-8 gap-1.5 rounded-full px-3 text-sm [&_svg:not([class*=size-])]:size-4",
  },
}

const TRIGGER_VARIANT = {
  framed:
    "justify-center hover:text-foreground data-[state=active]:text-foreground motion-safe:active:scale-x-97 motion-safe:active:scale-y-90",
  underline: "shrink-0 justify-center hover:text-foreground data-[state=active]:text-foreground",
  chips:
    "shrink-0 bg-raised text-foreground shadow-control hover:shadow-control-hover data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none data-[warning]:data-[state=inactive]:bg-warning-soft data-[warning]:data-[state=inactive]:text-warning-ink data-[warning]:data-[state=inactive]:shadow-[0_0_0_1px_var(--color-warning)] motion-safe:active:scale-x-97 motion-safe:active:scale-y-90",
}

/**
 * @param {object} props
 * @param {React.ReactNode} [props.count] A number in a pill after the label
 * @param {boolean|"danger"} [props.attention] Turns the count pill primary: the tab holds something that needs acting on. `"danger"` makes it red, for something that has gone wrong
 * @param {boolean} [props.warning] Chips only: tints the chip amber with a warning mark
 * @param {React.ReactNode} [props.tooltip] Shown on hover and keyboard focus
 */
function TabsTrigger({
  className,
  children,
  count,
  attention = false,
  warning = false,
  tooltip,
  value,
  onClick,
  ...props
}) {
  const tabs = React.useContext(TabsContext)
  const { variant, size } = React.useContext(TabsListContext)
  const active = tabs?.value === value
  const hasCount = count !== undefined && count !== null && count !== false

  // With asChild the trigger becomes its one child (a link), so the mark, label and count go
  // inside that child rather than beside it.
  const child = props.asChild && React.isValidElement(children) ? children : null
  const label = child ? child.props.children : children
  const parts = (
    <>
      {variant === "chips" && warning && <TriangleAlert aria-hidden className="size-4 text-warning" />}
      {label}
      {hasCount && (
        <span
          data-slot="tabs-count"
          data-attention={attention || undefined}
          className={cn(
            "inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full px-[7px] text-xs leading-4 font-medium tabular-nums",
            attention === "danger"
              ? "bg-destructive text-destructive-foreground"
              : attention
                ? "bg-primary text-primary-foreground"
                : variant === "chips" && active
                  ? "bg-background/20 text-background"
                  : "bg-tab-count text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}
    </>
  )
  const content = child ? React.cloneElement(child, undefined, parts) : parts

  // Radix's tooltip trigger writes its own data-state onto the element it wraps, which would
  // erase the tab's active state. Wrapping the other way round lets the tab's state win.
  const trigger = (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-warning={(variant === "chips" && warning) || undefined}
      data-count={hasCount || undefined}
      value={value}
      // Radix selects on mousedown and on keys; a click that arrives without either (a test, an
      // assistive tool) selects too, and the duplicate from a real click is skipped.
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && !props.disabled && tabs && tabs.value !== value) tabs.setValue(value)
      }}
      className={cn(
        "relative inline-flex cursor-pointer items-center font-medium whitespace-nowrap tabular-nums outline-none select-none",
        "transition-[color,background-color,box-shadow,scale] duration-160 ease-press motion-safe:active:duration-90",
        "focus-visible:shadow-focus-inset disabled:cursor-not-allowed disabled:opacity-40",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        "data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start",
        TRIGGER_SIZE[variant][size],
        TRIGGER_VARIANT[variant],
        className
      )}
      {...props}
      asChild={tooltip ? true : props.asChild}
    >
      {tooltip ? <TooltipTrigger asChild={!!child}>{content}</TooltipTrigger> : content}
    </TabsPrimitive.Trigger>
  )

  if (!tooltip) return trigger
  return (
    <Tooltip>
      {trigger}
      <TooltipContent className="max-w-[260px]">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function TabsContent({ className, ...props }) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
