"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A keycap. On a tooltip it takes the pill's white wash, and on a primary button the button's
 * own tone, so a shortcut never needs a variant at the call site.
 */
function Kbd({ className, ...props }) {
  return (
    <kbd
      data-ds="kbd"
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center gap-1 rounded-[6px] bg-muted px-1.5 font-mono text-xs leading-4 font-normal text-kbd-foreground shadow-kbd select-none [&_svg:not([class*='size-'])]:size-3.5",
        "in-[[data-slot=tooltip-content]]:h-5 in-[[data-slot=tooltip-content]]:min-w-5 in-[[data-slot=tooltip-content]]:rounded-[5px] in-[[data-slot=tooltip-content]]:bg-tooltip-key in-[[data-slot=tooltip-content]]:px-[5px] in-[[data-slot=tooltip-content]]:text-tooltip-foreground in-[[data-slot=tooltip-content]]:shadow-none",
        "in-[[data-variant=primary]]:bg-kbd-on-primary in-[[data-variant=primary]]:text-primary-foreground in-[[data-variant=primary]]:shadow-none",
        className
      )}
      {...props}
    />
  )
}

/** Keys 4 apart with nothing between them; a sequence puts `KbdThen` between its steps. */
function KbdGroup({ className, ...props }) {
  return (
    <span
      data-ds="kbd-group"
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1 in-[[data-slot=tooltip-content]]:gap-[3px]", className)}
      {...props}
    />
  )
}

function KbdThen({ className, ...props }) {
  return (
    <span data-slot="kbd-then" className={cn("px-0.5 text-xs text-muted-foreground", className)} {...props}>
      then
    </span>
  )
}

const MAC_PLATFORM = /mac|iphone|ipad|ipod/i

function subscribe() {
  return () => {}
}

function getPlatformIsMac() {
  const platform = navigator.userAgentData?.platform ?? navigator.platform ?? ""
  return MAC_PLATFORM.test(platform)
}

/**
 * True on Apple platforms, null until hydrated: the server cannot know the viewer's keyboard, and
 * guessing would show half of them the wrong modifier until the client corrected it.
 * @returns {boolean|null}
 */
function useIsMac() {
  return React.useSyncExternalStore(subscribe, getPlatformIsMac, () => null)
}

const KEY_SYMBOLS = {
  shift: "⇧",
  alt: "⌥",
  option: "⌥",
  ctrl: "⌃",
  enter: "↵",
  backspace: "⌫",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  esc: "Esc",
  escape: "Esc",
  tab: "Tab",
  space: "Space",
}

const WINDOWS_WORDS = {
  shift: "Shift",
  alt: "Alt",
  option: "Alt",
  ctrl: "Ctrl",
}

/**
 * One key's label. `mod` is ⌘ on a Mac and Ctrl elsewhere; modifiers are symbols on a Mac and
 * words elsewhere; letters are upper case.
 * @param {string} key
 * @param {boolean} isMac
 */
function keyLabel(key, isMac) {
  const lower = key.toLowerCase()
  if (lower === "mod" || lower === "cmd" || lower === "meta") return isMac ? "⌘" : "Ctrl"
  if (!isMac && WINDOWS_WORDS[lower]) return WINDOWS_WORDS[lower]
  if (KEY_SYMBOLS[lower]) return KEY_SYMBOLS[lower]
  return key.length === 1 ? key.toUpperCase() : key
}

/**
 * One cap per key, labelled for the viewer's platform. Renders nothing until hydrated.
 * @param {object} props
 * @param {string[]} props.keys Keys pressed together, such as `["mod", "k"]`.
 * @param {string[][]} [props.then] Further chords pressed after the first, read as "G then O".
 */
function KbdShortcut({ keys, then = [], ...props }) {
  const isMac = useIsMac()
  if (isMac === null) return null
  const chords = [keys, ...then]

  return (
    <KbdGroup
      aria-label={chords.map((c) => c.map((k) => keyLabel(k, isMac)).join(" ")).join(" then ")}
      {...props}
    >
      {chords.map((chord, index) => (
        <React.Fragment key={index}>
          {index > 0 && <KbdThen aria-hidden />}
          {chord.map((key) => (
            <Kbd key={key} aria-hidden>
              {keyLabel(key, isMac)}
            </Kbd>
          ))}
        </React.Fragment>
      ))}
    </KbdGroup>
  )
}

export { Kbd, KbdGroup, KbdShortcut, KbdThen, keyLabel, useIsMac }
