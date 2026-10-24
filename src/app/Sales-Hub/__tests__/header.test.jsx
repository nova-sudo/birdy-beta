import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries"
import {
  PageHeaderControls,
  PageHeaderProvider,
  PageHeaderTitle,
  useHasPageHeader,
} from "@/components/page-header"
import SalesHubPage from "../page"

Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Stands in for the real top bar: the wordmark and the page's title slot, in
// the same order layout.jsx puts them.
function Wordmark() {
  return useHasPageHeader() ? null : <span>Birdy</span>
}

function Bar() {
  return (
    <header>
      <PageHeaderTitle />
      <Wordmark />
      <PageHeaderControls />
    </header>
  )
}

const setDatePreset = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], meta: { total: 0 } }),
  })
  vi.mocked(useClientGroupsWithSeries).mockReturnValue({
    clientGroups: [
      { id: "g1", name: "Aura", ghl_location_id: "loc1" },
      { id: "g2", name: "Tylaesthetics", ghl_location_id: "loc2" },
    ],
    loading: false,
    datePreset: "last_7d",
    setDatePreset,
  })
})

describe("Sales Hub — top bar and header", () => {
  it("names the page in the top bar and in its own PageHeader", async () => {
    render(
      <PageHeaderProvider>
        <Bar />
        <SalesHubPage />
      </PageHeaderProvider>
    )

    await waitFor(() => expect(screen.queryByText("Birdy")).not.toBeInTheDocument())
    expect(document.querySelector('[data-ds="page-header"] h1')).toHaveTextContent("Sales Hub")
    expect(
      screen.getByText("Call-centre performance across your Hot Prospector clients")
    ).toBeInTheDocument()
  })

  it("puts the date range, granularity and client filters in the page header, still wired", async () => {
    const user = userEvent.setup()
    render(<SalesHubPage />)

    await user.click(screen.getByRole("combobox", { name: "Client group" }))
    await user.click(await screen.findByRole("option", { name: "Tylaesthetics" }))
    expect(screen.getByRole("combobox", { name: "Client group" })).toHaveTextContent("Tylaesthetics")

    // last_7d buckets daily on its own, so that is what the chip reads first.
    expect(screen.getByRole("combobox", { name: "Chart granularity" })).toHaveTextContent("Daily")
    await user.click(screen.getByRole("combobox", { name: "Chart granularity" }))
    await user.click(await screen.findByRole("option", { name: "Weekly" }))
    expect(screen.getByRole("combobox", { name: "Chart granularity" })).toHaveTextContent("Weekly")
  })

  it("releases the top bar when the page unmounts", async () => {
    const { rerender } = render(
      <PageHeaderProvider>
        <Bar />
        <SalesHubPage />
      </PageHeaderProvider>
    )
    await waitFor(() => expect(screen.queryByText("Birdy")).not.toBeInTheDocument())

    rerender(
      <PageHeaderProvider>
        <Bar />
      </PageHeaderProvider>
    )
    await waitFor(() => expect(screen.getByText("Birdy")).toBeInTheDocument())
  })
})
