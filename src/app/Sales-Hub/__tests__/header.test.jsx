import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: vi.fn() }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))

import { apiRequest } from "@/lib/api"
import { useClientGroups } from "@/lib/useClientGroups"
import {
  PageHeaderControls,
  PageHeaderProvider,
  PageHeaderTitle,
  useHasPageHeader,
} from "@/components/page-header"
import SalesHubPage from "../page"

// Stands in for the real top bar: the wordmark, the page's title slot and the
// page's control slot, in the same order layout.jsx puts them.
function Wordmark() {
  return useHasPageHeader() ? null : <span>Birdy</span>
}

function Harness() {
  return (
    <PageHeaderProvider>
      <header>
        <PageHeaderTitle />
        <Wordmark />
        <PageHeaderControls />
      </header>
      <SalesHubPage />
    </PageHeaderProvider>
  )
}

const setDatePreset = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], meta: { total: 0 } }),
  })
  vi.mocked(useClientGroups).mockReturnValue({
    clientGroups: [
      { id: "g1", name: "Aura", ghl_location_id: "loc1" },
      { id: "g2", name: "Tylaesthetics", ghl_location_id: "loc2" },
    ],
    loading: false,
    datePreset: "last_7d",
    setDatePreset,
  })
})

describe("Sales Hub — top bar", () => {
  it("puts its title in the bar and stands the wordmark down", async () => {
    render(<Harness />)

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Sales Hub" })).toBeInTheDocument()
    )
    expect(
      screen.getByText("Call-centre performance across your Hot Prospector clients")
    ).toBeInTheDocument()

    // The page replaces the wordmark rather than sitting beside it.
    expect(screen.queryByText("Birdy")).not.toBeInTheDocument()
  })

  it("carries no heading of its own in the page body", async () => {
    render(<Harness />)

    // Exactly one "Sales Hub" on screen — the one in the bar. A second would
    // mean the shell is still drawing the header it handed upwards.
    await waitFor(() => expect(screen.getAllByText("Sales Hub")).toHaveLength(1))
  })

  it("puts the date range and client filters in the bar, still wired", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const picker = await screen.findByRole("button", { name: /all clients/i })
    await user.click(picker)

    // The controls live in the header's tree but still close over the page's
    // state — which is the whole point of publishing nodes rather than values.
    await user.click(await screen.findByRole("option", { name: "Tylaesthetics" }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /tylaesthetics/i })).toBeInTheDocument()
    )
  })

  it("puts a granularity chip in the bar, defaulted to the window's own choice", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    // last_7d buckets daily on its own, so that is what the chip reads before
    // anyone touches it.
    const chip = await screen.findByRole("button", { name: /chart granularity: daily/i })
    await user.click(chip)
    await user.click(await screen.findByRole("option", { name: "Weekly" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /chart granularity: weekly/i })
      ).toBeInTheDocument()
    )
  })

  it("releases the bar when the page unmounts", async () => {
    const { unmount, rerender } = render(<Harness />)
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Sales Hub" })).toBeInTheDocument()
    )

    // Navigating away has to restore the wordmark without the next route
    // knowing it was ever replaced.
    rerender(
      <PageHeaderProvider>
        <header>
          <PageHeaderTitle />
          <Wordmark />
          <PageHeaderControls />
        </header>
      </PageHeaderProvider>
    )

    await waitFor(() => expect(screen.getByText("Birdy")).toBeInTheDocument())
    expect(screen.queryByRole("heading", { name: "Sales Hub" })).not.toBeInTheDocument()

    unmount()
  })
})
