import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Inbox } from "lucide-react"
import { Frame, Surface, Notice, EmptyState, ErrorState, Skeleton, Spinner } from "@/components/ds"

describe("Frame", () => {
  it("renders the title as an h2 on a muted rounded-frame root", () => {
    const { container } = render(
      <Frame title="Summary" meta="Last 7 days" actions={<button>Export</button>}>
        body
      </Frame>
    )
    expect(screen.getByRole("heading", { level: 2, name: "Summary" })).toBeTruthy()
    const root = container.firstChild
    expect(root.className).toContain("bg-muted")
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
})

describe("Surface", () => {
  it("has the surface shadow, radius and padding", () => {
    const { container } = render(<Surface>x</Surface>)
    const root = container.firstChild
    expect(root.className).toContain("shadow-surface")
    expect(root.className).toContain("rounded-surface")
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
  it("Skeleton pulses, honouring reduced motion", () => {
    const { container } = render(<Skeleton className="h-4" />)
    expect(container.firstChild.className).toContain("animate-pulse")
    expect(container.firstChild.className).toContain("motion-reduce:animate-none")
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
