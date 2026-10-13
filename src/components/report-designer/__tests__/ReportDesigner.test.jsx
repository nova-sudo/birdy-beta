import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...args) => apiRequest(...args) }))
vi.mock("@/components/birdy/Birdy", () => ({ default: () => null }))

// The chat is exercised elsewhere; here it only needs to report tool use.
let chatProps = null
vi.mock("@/components/chat/ChatConversation", () => ({
  default: (props) => {
    chatProps = props
    return <div>chat · {props.page}</div>
  },
}))

import ReportDesigner from "../ReportDesigner"

const json = (body) => Promise.resolve({ ok: true, json: async () => body })

const TEMPLATE = { frequency: "weekly", day: "Friday", time: "8:00 AM", sections: [{ type: "alerts" }] }

function previewWith(header) {
  return json({
    template: TEMPLATE,
    sample: false,
    blocks: [
      { type: "header", text: { type: "plain_text", text: header } },
      { type: "section", text: { type: "mrkdwn", text: "🔔 *Alerts:* none triggered" } },
    ],
  })
}

beforeEach(() => {
  apiRequest.mockReset()
  sessionStorage.clear()
  chatProps = null
})

describe("ReportDesigner", () => {
  it("starts a new conversation from the saved report and shows the real message", async () => {
    apiRequest.mockImplementation((url) =>
      url === "/api/report-designer/draft" ? json({ draft: TEMPLATE }) : previewWith("Birdy weekly brief · Last 7 days"))

    render(<ReportDesigner sessionKey="t1" />)

    await screen.findByText("Birdy weekly brief · Last 7 days")
    expect(screen.getByText("Alerts:")).toBeTruthy()
    expect(screen.getByText(/every friday at 8:00 am/i)).toBeTruthy()
    const urls = apiRequest.mock.calls.map(([u]) => u)
    expect(urls.indexOf("/api/report-designer/draft")).toBeLessThan(urls.indexOf("/api/report-designer/preview"))
    expect(chatProps.page).toBe("report_designer")
    expect(chatProps.hideInitialMessage).toBe(true)
    expect(chatProps.showScopePicker).toBe(false)
  })

  it("keeps the draft of a resumed conversation", async () => {
    sessionStorage.setItem("t2", "sess_1")
    apiRequest.mockImplementation(() => previewWith("Resumed"))
    render(<ReportDesigner sessionKey="t2" />)
    await screen.findByText("Resumed")
    expect(apiRequest.mock.calls.some(([u]) => u === "/api/report-designer/draft")).toBe(false)
  })

  it("refreshes the preview whenever Birdy changes the report", async () => {
    let n = 0
    apiRequest.mockImplementation((url) =>
      url === "/api/report-designer/draft" ? json({}) : previewWith(`Version ${++n}`))
    render(<ReportDesigner sessionKey="t3" />)
    await screen.findByText("Version 1")

    chatProps.onToolUsed("list_report_metrics")
    chatProps.onToolUsed("propose_report")

    await screen.findByText("Version 2")
  })

  it("hands the shown template to the caller", async () => {
    const onUse = vi.fn()
    apiRequest.mockImplementation((url) =>
      url === "/api/report-designer/draft" ? json({}) : previewWith("Ready"))
    render(<ReportDesigner sessionKey="t4" onUse={onUse} />)
    await screen.findByText("Ready")

    await userEvent.setup().click(screen.getByRole("button", { name: /use this report/i }))

    await waitFor(() => expect(onUse).toHaveBeenCalledWith(TEMPLATE))
  })
})

import { firstChange } from "../ReportDesigner"

describe("firstChange", () => {
  it("finds where a new or edited block starts", () => {
    const a = [{ type: "header" }, { type: "divider" }]
    expect(firstChange(a, a)).toBe(-1)
    expect(firstChange(a, [...a, { type: "data_visualization" }])).toBe(2)
    expect(firstChange(a, [{ type: "header" }, { type: "card" }])).toBe(1)
    expect(firstChange(a, [{ type: "header" }])).toBe(0)         // removal points at what's left
  })
})
