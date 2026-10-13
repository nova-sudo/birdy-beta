import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...args) => apiRequest(...args) }))
vi.mock("@/components/birdy/Birdy", () => ({ default: () => null }))

import ReportEditor from "../ReportEditor"

const json = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body })

const BLOCKS = [{ type: "header", text: { type: "plain_text", text: "Pulse" } }]
const BRIEF = { frequency: "weekly", day: "Monday", time: "8:00 AM", blocks: BLOCKS }

function serve({ errors } = {}) {
  apiRequest.mockImplementation((url) => {
    if (url === "/api/report-designer/state") return json({ catalog: [], clients: [], periods: [] })
    if (url === "/api/report-designer/preview") {
      return errors ? json({ detail: { errors } }, 400)
        : json({ blocks: [{ type: "header", text: { type: "plain_text", text: "Pulse · Last 7 days" } }] })
    }
    return json({})
  })
}

const lastPreview = () => {
  const calls = apiRequest.mock.calls.filter(([u]) => u === "/api/report-designer/preview")
  return JSON.parse(calls[calls.length - 1][1].body).template
}

beforeEach(() => apiRequest.mockReset())

describe("ReportEditor", () => {
  it("shows the blocks as JSON and previews what Slack will get", async () => {
    serve()
    render(<ReportEditor brief={BRIEF} />)
    expect(JSON.parse(screen.getByLabelText("Report blocks").value)).toEqual(BLOCKS)
    await screen.findByText("Pulse · Last 7 days")
    expect(lastPreview()).toEqual({ frequency: "weekly", time: "8:00 AM", day: "Monday", blocks: BLOCKS })
  })

  it("adds a native chart block from the menu", async () => {
    serve()
    const user = userEvent.setup()
    render(<ReportEditor brief={BRIEF} />)
    await user.click(screen.getByRole("button", { name: /add block/i }))
    await user.click(await screen.findByRole("menuitem", { name: /line chart by day/i }))
    const blocks = JSON.parse(screen.getByLabelText("Report blocks").value)
    expect(blocks[1]).toMatchObject({ type: "data_visualization", birdy_data: { chart: "line", by: "day" } })
  })

  it("says where the JSON is broken and blocks saving", async () => {
    serve()
    render(<ReportEditor brief={BRIEF} onSave={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Report blocks"), { target: { value: '[{"type": "divider",}]' } })
    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText(/isn't valid/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Save report" })).toBeDisabled()
  })

  it("lists what Slack won't accept", async () => {
    serve({ errors: ["block 1: alert blocks only work in modals"] })
    render(<ReportEditor brief={BRIEF} onSave={vi.fn()} />)
    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText(/only work in modals/)).toBeTruthy()
  })

  it("saves the blocks", async () => {
    serve()
    const onSave = vi.fn()
    render(<ReportEditor brief={BRIEF} onSave={onSave} />)
    await screen.findByText("Pulse · Last 7 days")
    await userEvent.setup().click(screen.getByRole("button", { name: "Save report" }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ blocks: BLOCKS, day: "Monday" }))
  })
})
