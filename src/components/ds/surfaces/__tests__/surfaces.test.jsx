import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Inbox } from "lucide-react"
import { Frame, FrameSurface, Surface, Notice, EmptyState, ErrorState, Skeleton, Spinner, useInsideFrame } from "@/components/ds"

describe("Frame", () => {
  it("renders the title as an h2 on a frame rounded-frame root", () => {
    const { container } = render(
      <Frame title="Summary" meta="Last 7 days" actions={<button>Export</button>}>
        body
      </Frame>
    )
    expect(screen.getByRole("heading", { level: 2, name: "Summary" })).toBeTruthy()
    const root = container.firstChild
    expect(root.className).toContain("bg-frame")
    expect(root.className).toContain("rounded-frame")
    expect(root.getAttribute("data-ds")).toBe("frame")
    expect(screen.getByText("Last 7 days").className).toContain("text-muted-foreground")
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy()
    expect(screen.getByText("body")).toBeTruthy()
  })

  it("honours titleAs", () => {
    render(<Frame title="Metrics" titleAs="h3" />)
    expect(screen.getByRole("heading", { level: 3, name: "Metrics" })).toBeTruthy()
  })

  it("is the Bytes shell: a hairline frame with no padding, a flush white surface and a footer strip", () => {
    const { container } = render(
      <Frame title="Locations" description="Live today" footer={<span>Note</span>} padded>
        body
      </Frame>
    )
    const root = container.firstChild
    expect(root).toHaveClass("shadow-frame", "rounded-frame", "bg-frame")
    expect(root.className).not.toMatch(/\bp-\d/)
    expect(root).toHaveAttribute("aria-labelledby", screen.getByRole("heading").id)
    const header = root.querySelector('[data-slot="frame-header"]')
    expect(header).toHaveClass("min-h-12", "px-4", "py-2")
    // The description sits under the title, not beside it.
    expect(header.querySelector('[data-slot="frame-description"]').textContent).toBe("Live today")
    const content = root.querySelector('[data-slot="frame-content"]')
    expect(content).toHaveClass("rounded-frame", "bg-background", "shadow-surface", "p-5")
    expect(content.textContent).toBe("body")
    expect(root.querySelector('[data-slot="frame-footer"]').textContent).toBe("Note")
  })

  it("aliases action and takes actions as data, folding past two into a menu", () => {
    const { rerender } = render(<Frame title="T" action={<button>Only</button>} />)
    expect(screen.getByRole("button", { name: "Only" })).toBeTruthy()
    const onClick = vi.fn()
    rerender(
      <Frame
        title="T"
        actions={[
          { label: "Export", onClick },
          { label: "Share" },
          { label: "Archive" },
        ]}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull()
    expect(screen.getByRole("button", { name: "More actions" })).toBeTruthy()
  })

  it("an href adds a View all link with an arrow", () => {
    render(<Frame title="Leads" href="/contacts" />)
    const link = screen.getByRole("link", { name: "View all" })
    expect(link).toHaveAttribute("href", "/contacts")
    expect(link.querySelector("svg")).not.toBeNull()
  })

  it("tells nested content it is inside a frame", () => {
    function Probe() {
      return <span>{useInsideFrame() ? "inside" : "outside"}</span>
    }
    render(
      <>
        <Probe />
        <Frame title="T">
          <Probe />
        </Frame>
        <FrameSurface label="Details">
          <Probe />
        </FrameSurface>
      </>
    )
    expect(screen.getAllByText("inside")).toHaveLength(2)
    expect(screen.getAllByText("outside")).toHaveLength(1)
    expect(screen.getByRole("group", { name: "Details" })).toHaveClass("rounded-control", "shadow-surface")
  })
})

describe("Surface", () => {
  it("has the surface shadow, radius and padding", () => {
    const { container } = render(<Surface>x</Surface>)
    const root = container.firstChild
    expect(root.className).toContain("shadow-surface")
    expect(root.className).toContain("rounded-frame")
    expect(root.className).toContain("bg-background")
    expect(root.className).toContain("p-4")
    expect(root.getAttribute("data-ds")).toBe("surface")
  })

  it("drops padding and swaps the element", () => {
    const { container } = render(<Surface as="section" padded={false}>x</Surface>)
    expect(container.firstChild.tagName).toBe("SECTION")
    expect(container.firstChild.className).not.toContain("p-4")
  })
})

describe("Notice", () => {
  it("warning tone uses soft bg, ink text and role=status", () => {
    render(<Notice tone="warning" title="Heads up" action={<a href="#">Fix</a>}>Budget low</Notice>)
    const el = screen.getByRole("status")
    expect(el.className).toContain("bg-warning-soft")
    expect(el.className).toContain("text-warning-ink")
    expect(screen.getByText("Heads up")).toBeTruthy()
    expect(screen.getByText("Budget low")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Fix" })).toBeTruthy()
  })

  it("defaults to info", () => {
    render(<Notice>fyi</Notice>)
    expect(screen.getByRole("status").className).toContain("bg-info-soft")
  })
})

describe("EmptyState", () => {
  it("renders icon, title, description and action", () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="Nothing yet" description="Add a client" action={<button>Add</button>} />
    )
    expect(container.firstChild.getAttribute("data-ds")).toBe("empty-state")
    expect(container.querySelector("svg")).toBeTruthy()
    expect(screen.getByText("Nothing yet")).toBeTruthy()
    expect(screen.getByText("Add a client")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy()
  })

  it("draws the 40 icon tile as a raised control", () => {
    const { container } = render(<EmptyState icon={Inbox} title="Nothing yet" />)
    const tile = container.querySelector("svg").parentElement
    expect(tile.className).toContain("size-10")
    expect(tile.className).toContain("rounded-control")
    expect(tile.className).toContain("bg-raised")
    expect(tile.className).toContain("shadow-control")
  })

  it("is plain by default and takes the faint empty ring as a surface", () => {
    const { container, rerender } = render(<EmptyState title="Nothing yet" />)
    expect(container.firstChild.className).not.toContain("shadow-empty-surface")
    rerender(<EmptyState title="Nothing yet" variant="surface" />)
    expect(container.firstChild.className).toContain("rounded-control")
    expect(container.firstChild.className).toContain("bg-background")
    expect(container.firstChild.className).toContain("shadow-empty-surface")
  })
})

describe("ErrorState", () => {
  it("calls onRetry from the retry button", () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    fireEvent.click(screen.getByRole("button", { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("defaults match LoadError copy and hides retry without a handler", () => {
    render(<ErrorState />)
    expect(screen.getByText("Couldn't load this")).toBeTruthy()
    expect(screen.getByText("The request failed.")).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("shows a custom description", () => {
    render(<ErrorState description="Timeout" />)
    expect(screen.getByText("Timeout")).toBeTruthy()
  })
})

describe("Skeleton and Spinner", () => {
  it("Skeleton is the skeleton grey with the sweep only under motion-safe", () => {
    const { container } = render(<Skeleton className="h-4" />)
    const cls = container.firstChild.className
    expect(cls).toContain("bg-skeleton")
    expect(cls).toContain("motion-safe:animate-skeleton")
    expect(cls).toContain("var(--color-skeleton-shine)")
    expect(cls).not.toContain("animate-pulse")
    expect(container.firstChild.getAttribute("data-ds")).toBe("skeleton")
  })

  it("Spinner is hidden by default and sized in px", () => {
    const { container } = render(<Spinner size={24} />)
    const el = container.firstChild
    expect(el.getAttribute("aria-hidden")).toBe("true")
    expect(el.getAttribute("data-ds")).toBe("spinner")
    expect(el.className.baseVal ?? el.className).toContain("animate-spin")
    expect(el.getAttribute("width")).toBe("24")
  })

  it("Spinner with a label is a status region", () => {
    render(<Spinner label="Loading data" />)
    expect(screen.getByRole("status").textContent).toContain("Loading data")
  })
})
