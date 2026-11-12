import * as React from "react"
import { describe, it, expect } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

import { SearchInput } from "../search-input"

// A parent whose state lands a beat late, the way a busy page re-renders after each keystroke.
function SlowParent({ onValue }) {
  const [value, setValue] = React.useState("")
  const onChange = React.useCallback((next) => {
    setTimeout(() => {
      setValue(next)
      onValue?.(next)
    }, 10)
  }, [onValue])
  return (
    <>
      <SearchInput value={value} onChange={onChange} debounceMs={0} placeholder="Search clients" />
      <button type="button" onClick={() => setValue("reset")}>outside</button>
    </>
  )
}

const box = () => screen.getByRole("searchbox")

describe("SearchInput", () => {
  it("keeps letters typed while the parent is still echoing an earlier one", async () => {
    render(<SlowParent />)
    // Each letter lands on whatever the box shows, and echoes arrive between letters.
    for (const letter of "Sculpt") {
      fireEvent.change(box(), { target: { value: box().value + letter } })
      await act(() => new Promise((r) => setTimeout(r, 6)))
    }
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(box()).toHaveValue("Sculpt")
  })

  it("still follows a value the parent sets itself", async () => {
    render(<SlowParent />)
    fireEvent.change(box(), { target: { value: "abc" } })
    await act(() => new Promise((r) => setTimeout(r, 30)))
    fireEvent.click(screen.getByRole("button", { name: "outside" }))
    expect(box()).toHaveValue("reset")
  })
})
