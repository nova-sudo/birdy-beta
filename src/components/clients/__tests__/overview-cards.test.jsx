import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"

// ─── Client overview cards, on the ds kit ────────────────────────────────────
// Goals as cells of one MetricGroup; the four cohort stages as one FunnelBar; the
// health badge in status tones.

import { GoalsStrip } from "@/components/clients/GoalsStrip"
import { DiagnosticsFunnel } from "@/components/clients/DiagnosticsFunnel"
import { HealthPill } from "@/components/clients/HealthPill"
import { buildFunnelStages } from "@/lib/client-funnel"

const goal = (over) => ({
  id: "cpl",
  label: "Cost per lead",
  value: 12,
  target: 10,
  format: "currency",
  source: "Meta",
  note: "Meta spend over Meta leads.",
  state: "At risk",
  ...over,
})

describe("GoalsStrip", () => {
  it("draws one cell per goal with its value, target and state badge", () => {
    render(
      <GoalsStrip
        currencySymbol="£"
        goals={[
          goal(),
          goal({ id: "closes", label: "Monthly closes", value: 4, target: 10, format: "number", state: "Behind" }),
          goal({ id: "revenue", label: "Revenue", value: 900, target: 1000, format: "currency", state: "On track" }),
        ]}
      />
    )
    const root = document.querySelector('[data-ds="goals-strip"]')
    const cells = root.querySelectorAll('[data-slot="metric-group-cell"]')
    expect(cells).toHaveLength(3)
    expect(within(cells[0]).getByText("£12.00")).toBeInTheDocument()
    expect(within(cells[0]).getByText("/ £10.00")).toBeInTheDocument()
    expect(within(cells[0]).getByText("At risk")).toHaveClass("bg-warning-soft")
    expect(within(cells[1]).getByText("Behind")).toHaveClass("bg-danger-soft")
    expect(within(cells[2]).getByText("On track")).toHaveClass("bg-success-soft")
  })

  it("a goal with no target is a plain figure with no state", () => {
    render(<GoalsStrip goals={[goal({ target: null, state: null })]} />)
    expect(document.querySelector('[data-slot="metric-group-cell"]').textContent).not.toMatch(/On track|Behind|At risk/)
    expect(screen.getByText(/No monthly targets set/)).toBeInTheDocument()
  })

  it("loading shows skeleton cells", () => {
    render(<GoalsStrip loading />)
    expect(document.querySelectorAll('[data-ds="goals-strip"] [data-ds="skeleton"]').length).toBeGreaterThan(5)
  })
})

describe("DiagnosticsFunnel", () => {
  const group = {
    call_log_provider: "ghl",
    gohighlevel: { metrics: { funnel: { leads: 1562, in_crm: 1049, called: 462, closes: 29 } } },
  }

  it("draws the four stages as one FunnelBar with shares of the cohort", () => {
    render(<DiagnosticsFunnel stages={buildFunnelStages(group)} hasComparison />)
    const bar = document.querySelector('[data-ds="funnel-bar"]')
    expect(bar).not.toBeNull()
    expect(within(bar).getByText("1,562")).toBeInTheDocument()
    expect(within(bar).getByText("67.2%")).toBeInTheDocument()
    expect(within(bar).getByText("1.9%")).toBeInTheDocument()
    // The comparison caveat only shows where there is none.
    expect(screen.queryByText(/No stage movement/)).toBeNull()
  })

  it("labels the first stage CRM leads, because the cohort is the CRM's, not the ad account's", () => {
    render(<DiagnosticsFunnel stages={buildFunnelStages(group)} />)
    const bar = document.querySelector('[data-ds="funnel-bar"]')
    expect(within(bar).getAllByText("CRM leads").length).toBeGreaterThan(0)
    expect(within(bar).queryByText("Leads")).toBeNull()
  })

  it("a stage with movement shows a delta, a falling one red", () => {
    const stages = buildFunnelStages(group, { leads: 1500, in_crm: 1000, called: 450, closes: 43 })
    render(<DiagnosticsFunnel stages={stages} hasComparison />)
    const deltas = document.querySelectorAll('[data-ds="funnel-bar"] [data-ds="delta"]')
    expect(deltas.length).toBe(4)
    expect(deltas[3]).toHaveAttribute("data-tone", "bad")
    expect(deltas[0]).toHaveAttribute("data-tone", "good")
  })

  it("says so when the window has no previous period", () => {
    render(<DiagnosticsFunnel stages={buildFunnelStages(group)} hasComparison={false} />)
    expect(screen.getByText(/No stage movement for this window/)).toBeInTheDocument()
  })

  it("a client with no call centre reads Called as a dash, not a zero", () => {
    const stages = buildFunnelStages({ ...group, call_log_provider: "none" })
    render(<DiagnosticsFunnel stages={stages} />)
    const bar = document.querySelector('[data-ds="funnel-bar"]')
    expect(within(bar).getAllByText("—").length).toBeGreaterThan(0)
    expect(within(bar).queryByText("462")).toBeNull()
  })

  it("no funnel for the window says so instead of drawing zeroes", () => {
    render(<DiagnosticsFunnel stages={null} />)
    expect(screen.getByText("No funnel data for this window yet.")).toBeInTheDocument()
    expect(document.querySelector('[data-ds="funnel-bar"]')).toBeNull()
  })

  it("loading draws the bar's skeleton", () => {
    render(<DiagnosticsFunnel stages={null} loading />)
    expect(document.querySelector('[data-ds="funnel-bar"] [data-ds="skeleton"]')).not.toBeNull()
  })
})

describe("HealthPill", () => {
  it("reads in the status tones, and falls back to Healthy", () => {
    const { rerender } = render(<HealthPill health="Critical" />)
    expect(screen.getByText("Critical")).toHaveClass("text-danger-ink")
    rerender(<HealthPill health="Warning" />)
    expect(screen.getByText("Warning")).toHaveClass("text-warning-ink")
    rerender(<HealthPill health="nonsense" />)
    expect(screen.getByText("Healthy")).toHaveClass("text-success-ink")
  })

  it("without a dot it is a soft chip", () => {
    render(<HealthPill health="Healthy" withDot={false} />)
    expect(screen.getByText("Healthy")).toHaveClass("bg-success-soft")
    expect(document.querySelector("[data-badge-dot]")).toBeNull()
  })
})
