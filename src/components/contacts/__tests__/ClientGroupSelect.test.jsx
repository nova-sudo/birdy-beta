import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { compile, optimize } from "@tailwindcss/node"

import { ClientGroupSelect } from "@/components/contacts/ClientGroupSelect"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.scrollIntoView ??= () => {}

const GROUPS = [
  { id: "g1", name: "Aura" },
  { id: "g2", name: "Autumn Rose Hair & Beauty" },
]

// Tests run with css: false, so a row's Tailwind classes are inert and a
// `pointer-events: none` on it goes unseen. Build the real CSS for every class
// on the page and put it in the document, so user-event clicks the way a
// browser would.
async function applyTailwind() {
  const candidates = new Set()
  for (const el of document.querySelectorAll("[class]")) {
    for (const c of el.getAttribute("class").split(/\s+/)) if (c) candidates.add(c)
  }
  const compiler = await compile('@import "tailwindcss/utilities";', { base: process.cwd(), onDependency() {} })
  const style = document.createElement("style")
  style.textContent = optimize(compiler.build([...candidates])).code
  document.head.append(style)
}

describe("ClientGroupSelect", () => {
  it("selects the client that is clicked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ClientGroupSelect clientGroups={GROUPS} value="all" onChange={onChange} />)

    await user.click(screen.getByRole("combobox", { name: "Client group" }))
    const row = await screen.findByRole("option", { name: "Autumn Rose Hair & Beauty" })
    await applyTailwind()

    expect(getComputedStyle(row).pointerEvents).not.toBe("none")
    await user.click(row)
    expect(onChange).toHaveBeenCalledWith("g2")
  })
})
