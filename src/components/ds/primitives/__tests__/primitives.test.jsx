import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Button, Badge, SegmentedTabs, Input, Kbd } from "@/components/ds"

describe("Button", () => {
  it("defaults to the outline variant at control height", () => {
    render(<Button>Save</Button>)
    const btn = screen.getByRole("button", { name: "Save" })
    expect(btn.className).toContain("h-control")
    expect(btn.className).toContain("shadow-control")
    expect(btn.getAttribute("data-ds")).toBe("button")
  })

  it("maps sizes to control heights", () => {
    const { rerender } = render(<Button size="sm">A</Button>)
    expect(screen.getByRole("button").className).toContain("h-control-sm")
    rerender(<Button size="lg">A</Button>)
    expect(screen.getByRole("button").className).toContain("h-control-lg")
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
  })

  it("asChild renders the child element", () => {
    render(
      <Button asChild>
        <a href="/x">Link</a>
      </Button>
    )
    expect(screen.getByRole("link", { name: "Link" }).className).toContain("h-control")
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
  it("Input has the control focus shadow", () => {
    render(<Input aria-label="name" />)
    expect(screen.getByLabelText("name").className).toContain("focus-visible:shadow-control-focus")
  })

  it("Kbd renders children", () => {
    render(<Kbd>⌘K</Kbd>)
    expect(screen.getByText("⌘K").tagName).toBe("KBD")
  })
})
