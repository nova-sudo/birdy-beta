import { createRegistry, builtinWidgets } from "dashkit/react"
import { PdFrame } from "./frame"
import { PdMarkdown } from "./markdown"

/** The widget kinds a Birdy dashboard can hold: dashkit's built-ins. */
export const registry = createRegistry(builtinWidgets)

/**
 * Host overrides for dashkit's component slots. One module-level object, not
 * built per render: ComponentsProvider memoizes on identity, and a fresh
 * object each render would remount every widget frame. Slots left out
 * (Button, Menu, Input, Select) fall back to dashkit's defaults, which the
 * provider merges in.
 */
export const components = { Frame: PdFrame, Markdown: PdMarkdown }
