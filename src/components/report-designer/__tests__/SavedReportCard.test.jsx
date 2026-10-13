import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...args) => apiRequest(...args) }))
vi.mock("@/components/birdy/Birdy", () => ({ default: () => null }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The designer is covered on its own; here it only needs to hand back a template.
vi.mock("../ReportDesigner", () => ({
  default: ({ onUse, primaryLabel }) => (
    <button onClick={() => onUse({ frequency: "daily", time: "7:00 AM", sections: [{ type: "alerts" }] })}>{primaryLabel}</button>
  ),
}))

vi.mock("../ReportEditor", () => ({
  default: ({ brief, onSave }) => (
    <button onClick={() => onSave({ ...brief, sections: [{ type: "underperforming_ads" }] })}>editor save</button>
  ),
}))

import SavedReportCard from "../SavedReportCard"

const json = (body) => Promise.resolve({ ok: true, json: async () => body })
const SAVED = { frequency: "weekly", day: "Monday", time: "8:00 AM", sections: [{ type: "alerts" }] }

beforeEach(() => apiRequest.mockReset())

describe("SavedReportCard", () => {
  it("previews the saved report, not the copilot's draft", async () => {
    apiRequest.mockImplementation(() => json({
      template: SAVED, sample: false,
      blocks: [{ type: "header", text: { type: "plain_text", text: "Birdy weekly brief · Last 7 days" } }],
    }))
    render(<SavedReportCard brief={SAVED} />)
    await screen.findByText("Birdy weekly brief · Last 7 days")
    expect(screen.getByText(/every monday at 8:00 am/i)).toBeTruthy()
    const [, opts] = apiRequest.mock.calls.find(([u]) => u === "/api/report-designer/preview")
    expect(JSON.parse(opts.body).source).toBe("saved")
  })

  it("saves a redesign and reports it upward", async () => {
    const onSaved = vi.fn()
    apiRequest.mockImplementation((url) => url === "/api/integrations/slack/brief"
      ? json({ ok: true, brief: { ...SAVED, frequency: "daily" } })
      : json({ template: SAVED, blocks: [] }))
    render(<SavedReportCard brief={SAVED} onSaved={onSaved} />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: /redesign with birdy/i }))
    await user.click(await screen.findByRole("button", { name: /save report/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...SAVED, frequency: "daily" }))
    const put = apiRequest.mock.calls.find(([u]) => u === "/api/integrations/slack/brief")
    expect(JSON.parse(put[1].body).template.time).toBe("7:00 AM")
  })

  it("says there is no report yet when nothing is saved", async () => {
    apiRequest.mockImplementation(() => json({ template: null, blocks: [] }))
    render(<SavedReportCard brief={null} />)
    await screen.findByText(/no report yet/i)
  })

  it("opens the hand editor on the saved report and saves its result", async () => {
    const onSaved = vi.fn()
    apiRequest.mockImplementation((url) => url === "/api/integrations/slack/brief"
      ? json({ ok: true, brief: SAVED })
      : json({ template: SAVED, blocks: [] }))
    render(<SavedReportCard brief={SAVED} onSaved={onSaved} />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: /edit sections/i }))
    expect(screen.getByText(/edit your slack report/i)).toBeTruthy()
    await user.click(screen.getByRole("button", { name: /editor save/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const put = apiRequest.mock.calls.find(([u]) => u === "/api/integrations/slack/brief")
    expect(JSON.parse(put[1].body).template).toMatchObject({ day: "Monday", sections: [{ type: "underperforming_ads" }] })
  })
})
