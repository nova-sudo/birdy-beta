"use client"

import * as React from "react"
import { Search, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "../primitives/input"
import { Label } from "../primitives/label"

const ICON_CLASSES = {
  sm: "right-3 size-4",
  md: "right-3.5 size-[18px]",
  lg: "right-4 size-5",
}

const PADDING_CLASSES = {
  sm: "pr-9",
  md: "pr-10",
  lg: "pr-11",
}

/**
 * A search field: the search icon on the right, swapped for a clear button once there is a query.
 * Typing updates the field at once and calls `onChange` after `debounceMs`; Enter sends it straight away.
 *
 * @param {object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.placeholder="Search..."]
 * @param {string} [props.label]
 * @param {string} [props.description]
 * @param {string} [props.inputClassName]
 * @param {() => void} [props.onFocus]
 * @param {() => void} [props.onBlur]
 * @param {number} [props.debounceMs=750] Zero calls `onChange` with every keystroke, for a filter that runs locally
 * @param {"sm"|"md"|"lg"} [props.size="md"] `sm` only beside `sm` buttons (toolbars, table filters)
 */
function SearchInput({
  value,
  onChange,
  placeholder,
  description,
  inputClassName,
  label,
  onFocus,
  onBlur,
  debounceMs = 750,
  size = "md",
  // Destructured so the spread below cannot hand it to the Input: React takes the later prop, so a
  // leaked className replaced the Input's own (dropping the icon clearance) instead of the wrapper's.
  className,
  ...props
}) {
  const autoId = React.useId()
  const inputId = props.id ?? autoId
  const [query, setQuery] = React.useState(value || "")
  const [syncedValue, setSyncedValue] = React.useState(value)
  // Every query this field has handed to `onChange`. The parent echoing one of them back is not an
  // outside change: resetting to it would drop whatever was typed while the echo was in flight
  // (typing "Sculpt" fast came out as "Sup").
  const emitted = React.useRef(new Set())

  if (!Object.is(value, syncedValue)) {
    setSyncedValue(value)
    if (emitted.current.has(value || "")) {
      emitted.current.delete(value || "")
    } else {
      emitted.current.clear()
      setQuery(value || "")
    }
  }

  const emit = React.useCallback(
    (next) => {
      emitted.current.add(next)
      onChange(next)
    },
    [onChange]
  )

  React.useEffect(() => {
    const normalizedValue = value || ""
    if (query !== normalizedValue) {
      // Zero means "no debounce", not "next macrotask": a purely local filter wants the list to
      // move with the keystroke.
      if (debounceMs === 0) {
        emit(query)
        return
      }
      const handler = setTimeout(() => {
        emit(query)
      }, debounceMs)

      return () => {
        clearTimeout(handler)
      }
    }
  }, [query, emit, value, debounceMs])

  const handleClear = () => {
    setQuery("")
    emit("")
  }

  const handleKeyDown = (e) => {
    const normalizedValue = value || ""
    if (e.key === "Enter" && query !== normalizedValue) {
      emit(query)
    }
  }

  return (
    <div data-ds="search-input" className={cn("w-full space-y-1", className)} onFocus={onFocus} onBlur={onBlur}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <div className="relative w-full">
        {/* The icon sits on the field's own side padding, so it lines up with the text margin. */}
        {!query ? (
          <Search
            aria-hidden
            data-slot="search-icon"
            className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground", ICON_CLASSES[size])}
          />
        ) : (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className={cn(
              "absolute top-1/2 flex -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-focus",
              ICON_CLASSES[size]
            )}
          >
            <XCircle aria-hidden className="size-full" />
          </button>
        )}
        <Input
          role="searchbox"
          id={inputId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Search..."}
          aria-label={label ?? placeholder ?? "Search"}
          size={size}
          className={cn("w-full", PADDING_CLASSES[size], inputClassName)}
          style={{ width: "100%" }}
          {...props}
        />
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

export { SearchInput }
