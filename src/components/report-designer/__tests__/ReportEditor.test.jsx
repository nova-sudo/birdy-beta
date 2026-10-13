import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...args) => apiRequest(...args) }))
vi.mock("@/components/birdy/Birdy", () => ({ default: () => null }))

import ReportEditor from "../ReportEditor"

const json = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body })

const BRIEF = {
  frequency: "weekly", day: "Monday", time: "8:00 AM", title: "Pulse",
  sections: [
    { type: "metric", metric: "spend", scope: "portfolio", compare: "previous" },
    { type: "ranking", metric: "leads", direction: "best", limit: 3 },
    { type: "birdy_take", focus: null },
  ],
}
const STATE = {
  catalog: [
    { id: "spend", label: "Ad spend", source: "Meta Ads", has_target: true },
    { id: "leads", label: "Leads", source: "Meta Ads", has_target: false },
  ],
  clients: [{ id: "g1", name: "Glow" }],
}

function serve({ previewStatus = 200, errors } = {}) {
  apiRequest.mockImplementation((url) => {
    if (url === "/api/report-designer/state") return json(STATE)
    if (url === "/api/report-designer/preview") {
      return previewStatus === 400
        ? json({ detail: { errors } }, 400)
        : json({ blocks: [{ type: "header", text: { type: "plain_text", text: "Pulse · Last 7 days" } }] })
    }
    return json({})
  })
}

const lastPreviewBody = () => {
  const calls = apiRequest.mock.calls.filter(([u]) => u === "/api/report-designer/preview")
  return JSON.parse(calls[calls.length - 1][1].body).template
}

beforeEach(() => apiRequest.mockReset())

describe("ReportEditor", () => {
  it("lists the report's sections and previews the real message", async () => {
    serve()
    render(<ReportEditor brief={BRIEF} />)
    await screen.findByText("Pulse · Last 7 days")
    expect(screen.getByText("Ad spend · All clients · vs previous period")).toBeTruthy()
    expect(screen.getByText("Top 3 clients by leads")).toBeTruthy()
    expect(screen.getByText(/always closes the report/i)).toBeTruthy()
    expect(lastPreviewBody()).toMatchObject({ frequency: "weekly", title: "Pulse" })
    expect(lastPreviewBody().sections[0]._key).toBeUndefined()
  })

  it("reorders and removes, then saves what is on screen", async () => {
    serve()
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ReportEditor brief={BRIEF} onSave={onSave} />)
    await screen.findByText("Pulse · Last 7 days")

    await user.click(screen.getAllByRole("button", { name: "Move down" })[0])
    await user.click(screen.getByRole("button", { name: "Remove Birdy's take" }))
    await waitFor(() => expect(lastPreviewBody().sections.map((s) => s.type)).toEqual(["ranking", "metric"]))
    await user.click(screen.getByRole("button", { name: "Save report" }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: "Pulse",
      sections: [BRIEF.sections[1], BRIEF.sections[0]],
    }))
  })

  it("shows why the server would refuse it and blocks saving", async () => {
    serve({ previewStatus: 400, errors: ["section 1: client 'x' is not one of this account's clients"] })
    render(<ReportEditor brief={BRIEF} onSave={vi.fn()} />)
    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText(/not one of this account's clients/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Save report" })).toBeDisabled()
  })

  it("can't save an empty report", async () => {
    serve()
    const user = userEvent.setup()
    render(<ReportEditor brief={{ ...BRIEF, sections: [{ type: "alerts" }] }} onSave={vi.fn()} />)
    await user.click(await screen.findByRole("button", { name: "Remove Alerts" }))
    expect(screen.getByText(/no sections yet/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Save report" })).toBeDisabled()
  })
})
