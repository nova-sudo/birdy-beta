import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Button, Badge, SegmentedTabs, Input, Kbd, KbdShortcut, Select, SelectTrigger, SelectValue, fieldVariants } from "@/components/ds"

describe("Button", () => {
  it("defaults to the outline variant at control height", () => {
    render(<Button>Save</Button>)
    const btn = screen.getByRole("button", { name: "Save" })
    expect(btn.className).toContain("h-10")
    expect(btn.className).toContain("shadow-control")
    expect(btn.getAttribute("data-ds")).toBe("button")
  })

  it("maps sizes to Bytes heights and radii", () => {
    const { rerender } = render(<Button size="sm">A</Button>)
    expect(screen.getByRole("button").className).toContain("h-8")
    expect(screen.getByRole("button").className).toContain("rounded-control-sm")
    rerender(<Button>A</Button>)
    expect(screen.getByRole("button").className).toContain("h-10")
    expect(screen.getByRole("button").className).toContain("text-base")
    rerender(<Button size="lg">A</Button>)
    expect(screen.getByRole("button").className).toContain("h-12")
    expect(screen.getByRole("button").className).toContain("rounded-control-lg")
  })

  it("secondary is an alias of outline, ghost has no fill", () => {
    const { rerender } = render(<Button variant="secondary">A</Button>)
    const secondary = screen.getByRole("button").className
    rerender(<Button>A</Button>)
    expect(screen.getByRole("button").className).toBe(secondary)
    expect(secondary).toContain("bg-raised")
    rerender(<Button variant="ghost">A</Button>)
    expect(screen.getByRole("button").className).toContain("hover:bg-ghost-hover")
    expect(screen.getByRole("button").className).not.toContain("bg-raised")
  })

  it("primary carries the primary shadow and data-variant", () => {
    render(<Button variant="primary">Go</Button>)
    expect(screen.getByRole("button").className).toContain("shadow-primary")
    expect(screen.getByRole("button").getAttribute("data-variant")).toBe("primary")
  })

  it("badge shows after the label and hides while loading", () => {
    const { rerender } = render(<Button badge={3}>Inbox</Button>)
    expect(screen.getByText("3")).toBeTruthy()
    rerender(<Button badge={3} loading>Inbox</Button>)
    expect(screen.queryByText("3")).toBeNull()
  })

  it("primary variant uses bg-primary", () => {
    render(<Button variant="primary">Go</Button>)
    expect(screen.getByRole("button").className).toContain("bg-primary")
  })

  it("loading sets aria-busy, disables, and keeps the label", () => {
    render(<Button loading>Save</Button>)
    const btn = screen.getByRole("button", { name: "Save" })
    expect(btn.getAttribute("aria-busy")).toBe("true")
    expect(btn.disabled).toBe(true)
    // jsdom applies no Tailwind CSS, so check the classes that would pull the
    // label out of the accessibility tree in a real browser.
    const label = screen.getByText("Save")
    expect(label.className).toContain("opacity-0")
    expect(label.className).not.toMatch(/(^|\s)(invisible|hidden)(\s|$)/)
    expect(label.closest("[aria-hidden]")).toBeNull()
  })

  it("asChild renders the child element", () => {
    render(
      <Button asChild>
        <a href="/x">Link</a>
      </Button>
    )
    expect(screen.getByRole("link", { name: "Link" }).className).toContain("h-10")
  })
})

describe("Badge", () => {
  it("danger soft uses -soft bg and -ink text", () => {
    render(<Badge tone="danger">Late</Badge>)
    const el = screen.getByText("Late")
    expect(el.className).toContain("bg-danger-soft")
    expect(el.className).toContain("text-danger-ink")
  })

  it("dot variant renders a status dot", () => {
    const { container } = render(
      <Badge tone="success" variant="dot">
        Live
      </Badge>
    )
    expect(container.querySelector("[data-badge-dot]")).not.toBeNull()
  })
})

describe("SegmentedTabs", () => {
  const items = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta", count: 3 },
  ]

  it("marks the active tab and reports clicks", () => {
    const onValueChange = vi.fn()
    render(<SegmentedTabs value="a" onValueChange={onValueChange} items={items} />)
    expect(screen.getByRole("tab", { name: /Alpha/ }).getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("tab", { name: /Beta/ }).getAttribute("aria-selected")).toBe("false")
    fireEvent.click(screen.getByRole("tab", { name: /Beta/ }))
    expect(onValueChange).toHaveBeenCalledWith("b")
  })
})

describe("Input / Kbd", () => {
  it("Input has the field focus shadow and a md default", () => {
    render(<Input aria-label="name" />)
    const el = screen.getByLabelText("name")
    expect(el.className).toContain("focus-visible:shadow-focus-field")
    expect(el.className).toContain("h-10")
    expect(el.className).toContain("text-base")
  })

  it("Input size prop maps to field sizes", () => {
    const { rerender } = render(<Input aria-label="name" size="sm" />)
    expect(screen.getByLabelText("name").className).toContain("h-8")
    rerender(<Input aria-label="name" size="lg" />)
    expect(screen.getByLabelText("name").className).toContain("h-12")
    expect(fieldVariants({ size: "sm" })).toContain("rounded-control-sm")
  })

  it("SelectTrigger takes the trigger surface and sizes", () => {
    render(
      <Select>
        <SelectTrigger aria-label="pick" size="sm"><SelectValue placeholder="x" /></SelectTrigger>
      </Select>
    )
    const el = screen.getByLabelText("pick")
    expect(el.className).toContain("h-8")
    expect(el.className).toContain("data-[state=open]:shadow-focus-field")
  })

  it("KbdShortcut labels keys for the platform", () => {
    render(<KbdShortcut keys={["mod", "i"]} />)
    const group = document.querySelector("[data-slot=kbd-group]")
    expect(group.querySelectorAll("kbd").length).toBe(2)
    expect(group.getAttribute("aria-label")).toMatch(/^(⌘|Ctrl) I$/)
  })

  it("Kbd renders children", () => {
    render(<Kbd>⌘K</Kbd>)
    expect(screen.getByText("⌘K").tagName).toBe("KBD")
  })
})
