import { describe, it, expect, vi, beforeEach } from "vitest"
import { Profiler } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

const replace = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams("step=accounts"),
}))

const fetchMock = vi.fn()
vi.mock("@/lib/fetcher", () => ({ fetcher: (...a) => fetchMock(...a) }))

const updateCreativeTest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { StepAccounts } from "../StepAccounts"
import { CreativeWizard } from "../CreativeWizard"
import * as api from "@/lib/creatives-api"

const ACCOUNTS = [{ ad_account_id: "act_1", name: "Harbour", currency: "GBP", clients: [{ id: "g1", name: "Harbour" }] }]
const wrap = (ui) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>

beforeEach(() => {
  fetchMock.mockReset()
  updateCreativeTest.mockReset()
})

describe("real hook behaviour", () => {
  it("does not re-render in a loop while an account's data is still loading", async () => {
    fetchMock.mockImplementation((url) => (url.endsWith("/ad-accounts") ? Promise.resolve(ACCOUNTS) : new Promise(() => {})))
    const user = userEvent.setup()
    let renders = 0
    const draft = { id: "t1", origin: "new", source: null, creative: { destination: "lead_form", accounts: [], media: { blob_url: "x" } } }
    render(
      wrap(
        <Profiler id="s" onRender={() => renders++}>
          <StepAccounts draft={draft} setField={() => {}} />
        </Profiler>
      )
    )
    await user.click(await screen.findByRole("checkbox", { name: "Select Harbour" }))
    await new Promise((r) => setTimeout(r, 100))
    expect(renders).toBeLessThan(15)
  })

  it("hands back the same empty array on every render", () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const seen = []
    function Probe() {
      seen.push(api.useCreativeAdsets("act_1", "website").adsets)
      return null
    }
    const { rerender } = render(wrap(<Probe />))
    rerender(wrap(<Probe />))
    expect(seen.length).toBeGreaterThan(1)
    expect(new Set(seen).size).toBe(1)
  })
})

describe("add-accounts mode", () => {
  it("sends no PATCH when a new account is selected", async () => {
    const posted = { id: "t1", code: "CT-0001", name: "n", slug: "n", origin: "new", status: "testing", creative: { destination: "website", primary_text: "x" }, ads: [] }
    fetchMock.mockImplementation((url) => {
      if (url === "/api/creatives/t1") return Promise.resolve(posted)
      if (url.endsWith("/ad-accounts")) return Promise.resolve(ACCOUNTS)
      return Promise.resolve([])
    })
    const spy = vi.spyOn(api, "updateCreativeTest").mockImplementation(updateCreativeTest)
    const user = userEvent.setup()
    render(wrap(<CreativeWizard testId="t1" />))
    await user.click(await screen.findByRole("checkbox", { name: "Select Harbour" }))
    await new Promise((r) => setTimeout(r, 1200))
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Select Harbour" })).toBeChecked())
    expect(updateCreativeTest).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
