"use client"

import * as React from "react"

/**
 * The modifier key's label for shortcut hints: "⌘" on Apple platforms, "Ctrl"
 * elsewhere. "⌘" until mounted, so server and first client render agree.
 */
export function useModKey() {
  const [label, setLabel] = React.useState("⌘")
  React.useEffect(() => {
    if (typeof navigator !== "undefined" && !/Mac|iPhone|iPad|iPod/i.test(navigator.platform)) {
      setLabel("Ctrl")
    }
  }, [])
  return label
}
