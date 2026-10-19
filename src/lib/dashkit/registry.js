import { createRegistry, builtinWidgets } from "dashkit/react"
import { PdFrame } from "./frame"
import { PdMarkdown } from "./markdown"
import { PdButton, PdIcon, PdInput, PdMenu, PdSelect } from "./primitives"

/** The widget kinds a Birdy dashboard can hold: dashkit's built-ins. */
export const registry = createRegistry(builtinWidgets)

/**
 * Host overrides for all of dashkit's component slots, so the dashboard and
 * its editor (toolbar, palette, property panel, canvas controls) render in
 * Birdy's pd look. One module-level object, not built per render:
 * ComponentsProvider memoizes on identity, and a fresh object each render
 * would remount every widget frame.
 */
export const components = {
  Frame: PdFrame,
  Markdown: PdMarkdown,
  Button: PdButton,
  Input: PdInput,
  Select: PdSelect,
  Menu: PdMenu,
  Icon: PdIcon,
}
