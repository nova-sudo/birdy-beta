import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { CircleCheck, MessageCircle, PhoneCall, Users } from "lucide-react"
import { FunnelGroup, Notice } from "@/components/ds"

const COMPARISON = "vs previous period"

const STAGES = [
  { key: "leads", label: "Leads", icon: Users, tone: "primary", value: 4726, delta: { change: 8, comparison: COMPARISON } },
  { key: "engaged", label: "Engaged", icon: MessageCircle, tone: "info", value: 2930, delta: { change: 4, comparison: COMPARISON } },
  { key: "called", label: "Called", icon: PhoneCall, tone: "warning", value: 1204, delta: { change: -6, comparison: COMPARISON } },
  {
    key: "closes",
    label: "Closes",
    icon: CircleCheck,
    tone: "success",
    value: 240,
    delta: { change: -12, comparison: COMPARISON },
    caption: "5.1% of leads",
  },
]

const root = () => document.querySelector('[data-ds="funnel-group"]')
const cells = () => Array.from(root().querySelectorAll('[data-slot="funnel-group-cell"]'))
const pills = () => Array.from(root().querySelectorAll('[data-slot="funnel-step"]'))

describe("FunnelGroup", () => {
  it("is a titled Frame carrying its own data-ds", () => {
    render(<FunnelGroup title="Performance funnel" description="From lead to close, across all clients" stages={STAGES} />)
    expect(root()).toHaveAttribute("data-slot", "frame")
    expect(screen.getByRole("heading", { name: "Performance funnel" })).toBeInTheDocument()
    expect(root()).toHaveTextContent("From lead to close, across all clients")
  })

  it("renders one cell per stage with its icon chip, label, value and delta", () => {
    render(<FunnelGroup title="Funnel" stages={STAGES} />)
    expect(cells()).toHaveLength(4)
    const [leads, , called, closes] = cells()
    expect(within(leads).getByText("Leads")).toBeInTheDocument()
    expect(within(leads).getByText("4,726")).toHaveAttribute("data-slot", "metric-value")
    expect(leads.querySelector('[data-slot="funnel-group-chip"] svg')).not.toBeNull()
    expect(leads.querySelector('[data-slot="funnel-group-chip"]')).toHaveClass("bg-primary-soft")
    expect(within(leads).getByText("8%")).toBeInTheDocument()
    expect(leads).toHaveTextContent(COMPARISON)
    expect(called.querySelector("[data-ds=delta]")).toHaveAttribute("data-tone", "bad")
    expect(closes).toHaveTextContent("5.1% of leads")
  })

  it("puts the step conversion between consecutive stages, hidden on narrow widths", () => {
    render(<FunnelGroup title="Funnel" stages={STAGES} />)
    // 2930/4726 = 62.0%, 1204/2930 = 41.1%, 240/1204 = 19.9%
    expect(pills().map((p) => p.textContent)).toEqual([
      "Leads to Engaged: 62%",
      "Engaged to Called: 41%",
      "Called to Closes: 20%",
    ])
    // The first stage has nothing before it.
    expect(cells()[0].querySelector('[data-slot="funnel-step"]')).toBeNull()
    for (const pill of pills()) {
      expect(pill).toHaveAttribute("data-ds", "badge")
      expect(pill).toHaveClass("hidden", "@3xl/metric-group:inline-flex")
    }
  })

  it("keeps a decimal on a small step rate", () => {
    render(
      <FunnelGroup
        title="Funnel"
        stages={[
          { key: "a", label: "A", value: 1000 },
          { key: "b", label: "B", value: 63 },
        ]}
      />
    )
    expect(pills()[0]).toHaveTextContent("6.3%")
  })

  it("hides the pill when the previous stage is zero or either side has no figure", () => {
    render(
      <FunnelGroup
        title="Funnel"
        stages={[
          { key: "a", label: "A", value: 0 },
          { key: "b", label: "B", value: 5 },
          { key: "c", label: "C", value: <span>—</span>, unavailable: true },
          { key: "d", label: "D", value: 2 },
        ]}
      />
    )
    expect(pills()).toHaveLength(0)
  })

  it("hides the pill above 100%, where a stage is not a narrowing of the one before", () => {
    render(
      <FunnelGroup
        title="Funnel"
        stages={[
          { key: "a", label: "A", value: 100 },
          { key: "b", label: "B", value: 150 },
        ]}
      />
    )
    expect(pills()).toHaveLength(0)
  })

  it("dims an unavailable stage's chip and shows no delta or caption for it", () => {
    render(
      <FunnelGroup
        title="Funnel"
        stages={[
          STAGES[0],
          { ...STAGES[2], value: <span>—</span>, unavailable: true, delta: undefined, caption: undefined },
        ]}
      />
    )
    const called = cells()[1]
    expect(called.querySelector('[data-slot="funnel-group-chip"]')).toHaveClass("bg-neutral-soft")
    expect(called.querySelector("[data-ds=delta]")).toBeNull()
  })

  it("goes two across on narrow widths and four from the metric-group breakpoint", () => {
    render(<FunnelGroup title="Funnel" stages={STAGES} />)
    expect(root().querySelector('[data-slot="funnel-group"]')).toHaveClass("grid-cols-2", "@3xl/metric-group:grid-cols-4")
  })

  it("sets a footer under the cells", () => {
    render(<FunnelGroup title="Funnel" stages={STAGES} footer={<Notice tone="warning">Problem</Notice>} />)
    expect(root().querySelector('[data-slot="frame-footer"]')).toHaveTextContent("Problem")
  })

  it("draws a flat stage's delta in the neutral no-change look", () => {
    render(<FunnelGroup title="Funnel" stages={[{ ...STAGES[0], delta: { change: 0, comparison: COMPARISON } }]} />)
    const delta = cells()[0].querySelector("[data-ds=delta]")
    expect(delta).toHaveAttribute("data-tone", "neutral")
    expect(delta).toHaveTextContent("No change")
  })

  it("sets the last stage's caption at the 13px type token", () => {
    render(<FunnelGroup title="Funnel" stages={STAGES} />)
    const caption = within(cells()[3]).getByText("5.1% of leads")
    expect(caption).toHaveAttribute("data-slot", "funnel-group-caption")
    expect(caption).toHaveClass("text-xs", "text-muted-foreground")
  })

  it("renders nothing without stages", () => {
    render(<FunnelGroup title="Funnel" stages={[]} />)
    expect(root()).toBeNull()
  })

  it("keeps the titled frame with a muted line when there are no stages but an empty message", () => {
    render(
      <FunnelGroup
        title="Performance funnel"
        stages={[]}
        empty="Funnel data for this period isn't ready yet."
        footer={<Notice tone="success">All looking good</Notice>}
      />
    )
    expect(screen.getByRole("heading", { name: "Performance funnel" })).toBeInTheDocument()
    const line = root().querySelector('[data-slot="funnel-group-empty"]')
    expect(line).toHaveTextContent("Funnel data for this period isn't ready yet.")
    expect(line).toHaveClass("text-muted-foreground")
    expect(cells()).toHaveLength(0)
    // The footer diagnoses the cells; with none, it claims nothing.
    expect(root().querySelector('[data-slot="frame-footer"]')).toBeNull()
    expect(root()).not.toHaveTextContent("All looking good")
  })
})

describe("Notice icon", () => {
  it("leads with the given icon in the tone's solid colour", () => {
    render(
      <Notice tone="warning" icon={Users} title="Heads up">
        Body
      </Notice>
    )
    const icon = document.querySelector('[data-ds="notice"] svg')
    expect(icon).toHaveClass("text-warning")
    expect(document.querySelector('[data-ds="notice"]')).toHaveClass("items-start")
  })

  it("stays centred with no icon", () => {
    render(<Notice>Plain</Notice>)
    expect(document.querySelector('[data-ds="notice"] svg')).toBeNull()
    expect(document.querySelector('[data-ds="notice"]')).toHaveClass("items-center")
  })
})
