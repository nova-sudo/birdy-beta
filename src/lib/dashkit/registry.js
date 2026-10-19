import { createRegistry, builtinWidgets } from "dashkit/react"
import { PdMarkdown } from "./markdown"

/** The widget kinds a Birdy dashboard can hold: dashkit's built-ins. */
export const registry = createRegistry(builtinWidgets)

/**
 * Host overrides for dashkit's component slots. dashkit's own Frame, Button,
 * Input, Select, Menu and Icon already render in Birdy's look through the
 * `--dk-*` theme (globals.css), so only Markdown is Birdy's: the text widget
 * renders prose like chat messages do (without it dashkit shows plain text).
 * One module-level object, not built per render: ComponentsProvider memoizes
 * on identity, and a fresh object each render would remount every widget.
 */
export const components = {
  Markdown: PdMarkdown,
}
