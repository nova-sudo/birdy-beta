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

describe("ReportEditor for another feature (previewFn, placeholders, extraMetricsDisabled)", () => {
  const PREVIEW = { blocks: [{ type: "header", text: { type: "plain_text", text: "Card preview" } }], sample: true }

  it("previews through previewFn and never asks the report designer", async () => {
    const previewFn = vi.fn().mockResolvedValue(PREVIEW)
    render(<ReportEditor brief={BRIEF} previewFn={previewFn} extraMetricsDisabled />)
    await screen.findByText("Card preview")
    expect(previewFn).toHaveBeenCalledWith(expect.objectContaining({ blocks: BLOCKS }))
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("lists previewFn's errors and keeps Save off", async () => {
    const err = Object.assign(new Error("This template can't be used"), { errors: ["block 2: unknown placeholder"] })
    render(<ReportEditor brief={BRIEF} previewFn={vi.fn().mockRejectedValue(err)} onSave={vi.fn()} extraMetricsDisabled />)
    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText("block 2: unknown placeholder")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Save report" })).toBeDisabled()
  })

  it("offers the given placeholders and writes the one picked", async () => {
    const user = userEvent.setup()
    render(<ReportEditor brief={BRIEF} previewFn={vi.fn().mockResolvedValue(PREVIEW)} placeholders={["client", "zone"]} extraMetricsDisabled />)
    await user.click(screen.getByRole("button", { name: /insert value/i }))
    expect(await screen.findByRole("menuitem", { name: "{{zone}}" })).toBeTruthy()
    await user.click(screen.getByRole("menuitem", { name: "{{client}}" }))
    expect(screen.getByLabelText("Report blocks").value).toContain("{{client}}")
  })

  it("without report figures there is no live-number picker and no metric blocks", async () => {
    const user = userEvent.setup()
    render(<ReportEditor brief={BRIEF} previewFn={vi.fn().mockResolvedValue(PREVIEW)} extraMetricsDisabled />)
    expect(screen.queryByRole("button", { name: /insert live number/i })).toBeNull()
    await user.click(screen.getByRole("button", { name: /add block/i }))
    expect(await screen.findByRole("menuitem", { name: /divider/i })).toBeTruthy()
    expect(screen.queryByRole("menuitem", { name: /line chart/i })).toBeNull()
  })

  it("saveLabel names the Save button", async () => {
    render(<ReportEditor brief={BRIEF} previewFn={vi.fn().mockResolvedValue(PREVIEW)} saveLabel="Save template" extraMetricsDisabled />)
    expect(await screen.findByRole("button", { name: "Save template" })).toBeTruthy()
  })

  it("drops a slow preview that an edit has already replaced", async () => {
    let first
    const previewFn = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { first = resolve }))
      .mockResolvedValue({ blocks: [{ type: "header", text: { type: "plain_text", text: "Newer preview" } }] })
    render(<ReportEditor brief={BRIEF} previewFn={previewFn} extraMetricsDisabled />)
    await waitFor(() => expect(previewFn).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText("Report blocks"), { target: { value: JSON.stringify([{ type: "divider" }]) } })
    await screen.findByText("Newer preview")
    first({ blocks: [{ type: "header", text: { type: "plain_text", text: "Older preview" } }] })
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByText("Older preview")).toBeNull()
    expect(screen.getByText("Newer preview")).toBeTruthy()
  })

  it("a stale refusal doesn't put its errors on a newer draft", async () => {
    let first
    const stale = Object.assign(new Error("no"), { errors: ["old problem"] })
    const previewFn = vi
      .fn()
      .mockImplementationOnce(() => new Promise((_, reject) => { first = () => reject(stale) }))
      .mockResolvedValue({ blocks: [{ type: "header", text: { type: "plain_text", text: "Fine now" } }] })
    render(<ReportEditor brief={BRIEF} previewFn={previewFn} extraMetricsDisabled />)
    await waitFor(() => expect(previewFn).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText("Report blocks"), { target: { value: JSON.stringify([{ type: "divider" }]) } })
    await screen.findByText("Fine now")
    first()
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByText("old problem")).toBeNull()
  })

  it("an unmounted editor ignores a preview that arrives late", async () => {
    let resolve
    const previewFn = vi.fn(() => new Promise((r) => { resolve = r }))
    const { unmount } = render(<ReportEditor brief={BRIEF} previewFn={previewFn} extraMetricsDisabled />)
    await waitFor(() => expect(previewFn).toHaveBeenCalled())
    unmount()
    resolve({ blocks: [] })
    await new Promise((r) => setTimeout(r, 20))
  })

  it("extraBlocks add items to Add block", async () => {
    const user = userEvent.setup()
    const block = vi.fn(() => ({ type: "table", birdy_data: { source: "agent_run" } }))
    render(<ReportEditor brief={BRIEF} previewFn={vi.fn().mockResolvedValue({ blocks: [] })} extraMetricsDisabled extraBlocks={[{ id: "t", label: "Client table", hint: "Rows", block }]} />)
    await user.click(screen.getByRole("button", { name: /add block/i }))
    await user.click(await screen.findByRole("menuitem", { name: /client table/i }))
    expect(JSON.parse(screen.getByLabelText("Report blocks").value)[1]).toEqual({ type: "table", birdy_data: { source: "agent_run" } })
  })
})
