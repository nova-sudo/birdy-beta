import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Settings → Billing → credits ───────────────────────────────────────────
// Balance, top-up packs and the usage block, drawn from ds tokens.

const credits = vi.hoisted(() => ({ value: null, onRender: null }))
vi.mock("@/hooks/useCredits", () => {
  const useCredits = () => {
    credits.onRender?.()
    return credits.value
  }
  return { useCredits, default: useCredits }
})
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@whop/checkout/react", () => ({
  WhopCheckoutEmbed: ({ prefill }) => <div data-testid="whop" data-email={prefill?.email ?? ""} />,
}))
// recharts measures its container; jsdom has no layout, so stand in for it.
vi.mock("recharts", () => {
  const Stub = ({ children }) => <div>{children}</div>
  return {
    BarChart: Stub, Bar: Stub, XAxis: Stub, YAxis: Stub, Tooltip: Stub, CartesianGrid: Stub,
    ResponsiveContainer: ({ children }) => <div data-testid="usage-chart">{children}</div>,
  }
})

import { apiRequest } from "@/lib/api"
import { CreditsPanel } from "../CreditsPanel"

const STATUS = {
  loading: false,
  status: { out: false },
  balance: 1200,
  topupBalance: 200,
  allowance: 1000,
  remainingAllowance: 400,
  isOut: false,
  low: false,
  enforced: true,
  refresh: vi.fn(),
}

function respond({ usage, packs } = {}) {
  vi.mocked(apiRequest).mockImplementation(async (url) => {
    if (url.startsWith("/api/credits/usage")) return { ok: true, json: async () => usage ?? { total_questions: 0, total_credits: 0, by_day: [], by_feature: {} } }
    if (url === "/api/credits/topup-packs") return { ok: true, json: async () => ({ packs: packs ?? [] }) }
    return { ok: false, json: async () => ({}) }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  credits.value = { ...STATUS }
  localStorage.clear()
})

describe("CreditsPanel", () => {
  it("shows the balance and what it includes", async () => {
    respond()
    render(<CreditsPanel />)
    expect(await screen.findByText("credits left", { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/includes 200 top-up/)).toBeInTheDocument()
    expect(screen.getByText("40%")).toBeInTheDocument()
  })

  it("flags a low or empty balance with a status badge", async () => {
    respond()
    credits.value = { ...STATUS, low: true }
    const { rerender, container } = render(<CreditsPanel />)
    expect(await screen.findByText("Running low")).toBeInTheDocument()
    expect(container.querySelector('[data-ds="badge"]')).not.toBeNull()
    credits.value = { ...STATUS, isOut: true, balance: 0, remainingAllowance: 0 }
    rerender(<CreditsPanel />)
    expect(await screen.findByText("Out of credits")).toBeInTheDocument()
  })

  it("lists the top-up packs under 10k and opens checkout for the one picked", async () => {
    respond({
      packs: [
        { id: "a", credits: 500, price: 5, plan_id: "plan_a" },
        { id: "b", credits: 10000, price: 90, plan_id: "plan_b" },
        { id: "c", credits: 2000, price: 18, plan_id: null },
      ],
    })
    const user = userEvent.setup()
    render(<CreditsPanel />)
    const pack = await screen.findByRole("button", { name: /500 credits/ })
    expect(screen.queryByRole("button", { name: /10,000 credits/ })).toBeNull()
    expect(screen.getByRole("button", { name: /2,000 credits/ })).toBeDisabled()
    await user.click(pack)
    expect(await screen.findByTestId("whop")).toBeInTheDocument()
    expect(screen.getByText("500 Birdy Credits")).toBeInTheDocument()
  })

  it("draws the 30-day usage with the per-feature totals", async () => {
    respond({
      usage: {
        total_questions: 12,
        total_credits: 340.4,
        by_day: [{ date: "2026-10-23", credits: 20 }],
        by_feature: { ask_birdy: 300, suggestions: 40 },
      },
    })
    render(<CreditsPanel />)
    expect(await screen.findByTestId("usage-chart")).toBeInTheDocument()
    expect(screen.getByText(/12 questions · 340 credits/)).toBeInTheDocument()
    expect(screen.getByText("Ask Birdy")).toBeInTheDocument()
    expect(screen.getByText("Suggestions")).toBeInTheDocument()
  })

  it("says so when there is no usage in the window", async () => {
    respond({ usage: { total_questions: 0, total_credits: 0, by_day: [], by_feature: {} } })
    render(<CreditsPanel />)
    expect(await screen.findByText("No AI usage yet in this window.")).toBeInTheDocument()
  })

  it("reads the stored email after mount, not while rendering, and hands it to checkout", async () => {
    localStorage.setItem("user", JSON.stringify({ email: "ada@example.com" }))
    respond({ packs: [{ id: "a", credits: 500, price: 5, plan_id: "plan_a" }] })
    const getItem = vi.spyOn(Storage.prototype, "getItem")
    const userReads = () => getItem.mock.calls.filter(([k]) => k === "user").length
    // useCredits runs inside the panel's render; record how many reads had
    // happened by each render.
    const seenAtRender = []
    credits.onRender = () => seenAtRender.push(userReads())
    const user = userEvent.setup()
    render(<CreditsPanel />)
    expect(seenAtRender[0]).toBe(0)
    await waitFor(() => expect(userReads()).toBeGreaterThan(0))
    await user.click(await screen.findByRole("button", { name: /500 credits/ }))
    expect((await screen.findByTestId("whop")).dataset.email).toBe("ada@example.com")
    getItem.mockRestore()
    credits.onRender = null
  })
})
