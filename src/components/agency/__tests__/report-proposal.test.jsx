import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { apiRequest } from "@/lib/api"
import { ReplyProposals } from "../chat/proposal-card"

const calls = { apply: vi.fn(), dismiss: vi.fn() }
vi.mock("@/lib/proposals-api", async (orig) => ({ ...(await orig()), applyProposal: (...a) => calls.apply(...a), dismissProposal: (...a) => calls.dismiss(...a) }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("@/lib/section-chats", () => ({ rememberSectionChat: vi.fn() }))
vi.mock("@/components/report-designer/SlackMessagePreview", () => ({
  default: ({ blocks, loading }) => <div data-testid="slack-preview">{loading ? "loading" : `${(blocks ?? []).length} blocks`}</div>,
}))

const TEMPLATE = { blocks: [{ type: "header", text: { type: "plain_text", text: "Daily Sales Performance" } }] }
const REPORT = (o) => ({
  id: "p7", kind: "slack_report", agent: "sales_coach", proposed_by: "sales_coach", status: "pending", title: "Daily Sales Performance",
  schedule_label: "Every day · 09:00",
  sends_to: { channel_id: "C1", channel_name: "sales-team", default_channel: false },
  payload: { name: "Daily Sales Performance", owner: "sales_coach", trigger: { type: "schedule" }, channel_id: "C1", channel_name: "sales-team", enabled: true, template: TEMPLATE },
  ...o,
})

/** The preview answers when `release` is called, so a test can look at the card while it loads. */
function previewResponds({ sample = false, fail = false } = {}) {
  let release
  const gate = new Promise((r) => { release = r })
  vi.mocked(apiRequest).mockImplementation(async () => {
    await gate
    return fail ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ blocks: [{}, {}, {}], sample }) }
  })
  return () => release()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockReset()
})

describe("a report proposed in chat (1A)", () => {
  it("loads the preview by itself and keeps Approve off until it has", async () => {
    const release = previewResponds()
    render(<ReplyProposals proposals={[REPORT()]} onUpdate={vi.fn()} />)
    const card = screen.getByRole("group", { name: "Proposal: Daily Sales Performance" })
    expect(card).toHaveTextContent("Sales Coach wants to create a report")
    expect(card).toHaveTextContent("Waiting for you")
    expect(card).toHaveTextContent("Every day · 09:00")
    expect(card).toHaveTextContent("sales-team")
    expect(card).toHaveTextContent("Sales Coach reports")
    expect(card).toHaveTextContent("Sales Coach makes it")
    expect(screen.queryByRole("button", { name: "Show a preview" })).toBeNull()
    expect(screen.getByTestId("slack-preview")).toHaveTextContent("loading")
    expect(screen.getByRole("button", { name: "Approve and create" })).toBeDisabled()

    release()
    expect(await screen.findByText("3 blocks")).toBeInTheDocument()
    expect(screen.getByText("Today’s real numbers. Your Slack shows it like this.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve and create" })).toBeEnabled()
    const [path, init] = vi.mocked(apiRequest).mock.calls[0]
    expect(path).toBe("/api/report-designer/preview")
    expect(JSON.parse(init.body)).toEqual({ template: TEMPLATE, owner: "sales_coach" })
  })

  it("says when figures are samples", async () => {
    previewResponds({ sample: true })()
    render(<ReplyProposals proposals={[REPORT()]} />)
    expect(await screen.findByText(/Some figures are samples/)).toBeInTheDocument()
    expect(screen.queryByText(/Today’s real numbers/)).toBeNull()
  })

  it("lets the owner decide when the preview fails, and offers a retry", async () => {
    previewResponds({ fail: true })()
    render(<ReplyProposals proposals={[REPORT()]} />)
    expect(await screen.findByText("Couldn’t build the preview.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve and create" })).toBeEnabled()
  })

  it("approving creates it and keeps the report on the reply", async () => {
    previewResponds()()
    calls.apply.mockResolvedValue({ ok: true, report: { id: "r42", owner: "sales_coach", name: "Daily Sales Performance" } })
    const onUpdate = vi.fn()
    render(<ReplyProposals proposals={[REPORT()]} onUpdate={onUpdate} />)
    const approve = screen.getByRole("button", { name: "Approve and create" })
    await waitFor(() => expect(approve).toBeEnabled())
    await userEvent.click(approve)
    expect(calls.apply).toHaveBeenCalledWith("p7")
    expect(onUpdate).toHaveBeenCalledWith("p7", { status: "approved", report: { id: "r42", owner: "sales_coach", name: "Daily Sales Performance" } })
  })

  it("shows the server's reason when it refuses", async () => {
    previewResponds()()
    calls.apply.mockRejectedValue(Object.assign(new Error("x"), { status: 400, detail: "That channel is gone. Pick another." }))
    render(<ReplyProposals proposals={[REPORT()]} onUpdate={vi.fn()} />)
    const approve = screen.getByRole("button", { name: "Approve and create" })
    await waitFor(() => expect(approve).toBeEnabled())
    await userEvent.click(approve)
    expect(await screen.findByText("That channel is gone. Pick another.")).toBeInTheDocument()
  })

  it("Change something says where to ask", async () => {
    previewResponds()()
    render(<ReplyProposals proposals={[REPORT({ agent: "birdy", proposed_by: "birdy", sends_to: { channel_id: null, channel_name: null, default_channel: true } })]} />)
    expect(screen.getByText("Default Birdy channel")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Change something" }))
    expect(screen.getByText("Tell Birdy what to change below.")).toBeInTheDocument()
  })

  it("once approved, says when and where it sends, with a link to the report", () => {
    render(<ReplyProposals proposals={[REPORT({ status: "approved", report: { id: "r42", owner: "sales_coach" } })]} />)
    expect(screen.getByText("Created. Sends every day · 09:00 to #sales-team.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Open in Sales Coach reports/ })).toHaveAttribute("href", "/sales-coach/reports/r42")
    expect(screen.queryByRole("button", { name: "Approve and create" })).toBeNull()
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("approved without the report's id links to the owner's Reports, and keeps day names", () => {
    render(<ReplyProposals proposals={[REPORT({ agent: "media_buyer", status: "approved", schedule_label: "Mondays · 09:00" })]} />)
    expect(screen.getByText("Created. Sends Mondays · 09:00 to #sales-team.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Open in Marketing Guru reports/ })).toHaveAttribute("href", "/media-buyer/reports")
  })

  it("declining says nothing was made", async () => {
    previewResponds()()
    calls.dismiss.mockResolvedValue({ ok: true })
    const onUpdate = vi.fn()
    const view = render(<ReplyProposals proposals={[REPORT()]} onUpdate={onUpdate} />)
    await userEvent.click(screen.getByRole("button", { name: "Decline" }))
    expect(calls.dismiss).toHaveBeenCalledWith("p7")
    expect(onUpdate).toHaveBeenCalledWith("p7", { status: "dismissed" })
    view.rerender(<ReplyProposals proposals={[REPORT({ status: "dismissed" })]} />)
    expect(screen.getByText("Declined")).toBeInTheDocument()
    expect(screen.getByText("Nothing was changed.")).toBeInTheDocument()
    expect(screen.queryByTestId("slack-preview")).toBeNull()
  })
})
