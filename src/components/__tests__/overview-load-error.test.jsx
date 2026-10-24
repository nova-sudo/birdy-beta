import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(() => Promise.resolve({ ok: false })) }))
vi.mock("@/lib/fonts", () => ({ pdFontClass: "" }))

import { CallCentreOverview } from "@/components/saleshub/CallCentreOverview"

// The row sums its KPI tiles out of the client groups they are handed. Given
// an empty list they render 0 across the board and a chart that says nothing
// happened this window — which is what a failed fetch used to look like, since
// `loading` had already gone false and neither page rendered the error.
const props = {
  clientGroups: [],
  groupsLoading: false,
  datePreset: "last_30_days",
}

// (The Lead Hub's equivalent lives in contacts/__tests__/LeadHubOverview.test.jsx.)
describe.each([
  ["Call Centre", CallCentreOverview],
])("%s overview", (_name, Overview) => {
  it("says the data is missing rather than showing it as zero", () => {
    render(<Overview {...props} groupsError="HTTP 500" />)

    expect(screen.getByText(/couldn’t load your client data/i)).toBeInTheDocument()
    expect(screen.getByText("HTTP 500")).toBeInTheDocument()
    // No tile may claim a figure while the fetch is known to have failed.
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })

  it("offers a retry that calls back", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<Overview {...props} groupsError="HTTP 500" onRetry={onRetry} />)

    await user.click(screen.getByRole("button", { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("draws its normal row when there is no error", () => {
    render(<Overview {...props} />)
    expect(screen.queryByText(/couldn’t load your client data/i)).not.toBeInTheDocument()
  })
})
