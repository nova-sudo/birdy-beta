import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { ReplyProposals } from "../chat/proposal-card"

const calls = { apply: vi.fn(), dismiss: vi.fn(), undo: vi.fn(), patch: vi.fn(), approve: vi.fn(), reject: vi.fn() }
const remember = vi.fn()
vi.mock("@/lib/proposals-api", async (orig) => ({ ...(await orig()), applyProposal: (...a) => calls.apply(...a), dismissProposal: (...a) => calls.dismiss(...a), undoProposal: (...a) => calls.undo(...a) }))
// The sub-agent routes, by address: PATCH /api/agents/sub/{id}, POST …/approve and …/reject.
vi.mock("@/lib/context-api", async (orig) => ({
  ...(await orig()),
  request: (url, method, body) => {
    const id = url.split("/")[4]
    if (method === "PATCH") return calls.patch(id, body)
    if (url.endsWith("/approve")) return calls.approve(id)
    if (url.endsWith("/reject")) return calls.reject(id)
    throw new Error(`unexpected ${method} ${url}`)
  },
}))
vi.mock("@/lib/section-chats", () => ({ rememberSectionChat: (...a) => remember(...a) }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [{ id: "g0", name: "Aura", client_status: "Active" }, { id: "g1", name: "Beaulea", client_status: "Active" }], loading: false }) }))

const P = (o) => ({ id: "p1", agent: "media_buyer", title: "Put the old lead form back", detail: "Lead form: v2 → v1", kind: "lead_form", payload: {}, status: "pending", proposed_by: "media_buyer", client_group_id: "g0", ...o })
const RECORD = { id: "s3", parent: "media_buyer", kind: "specialist", name: "Fatigue watcher", purpose: "Spots tired ads", instructions: "Check daily", tools: [{ name: "ad_insights", label: "Ad results" }, { name: "frequency", label: "Frequency by ad" }], clients: [{ id: "g0", name: "Aura" }], schedule: null, status: "proposed" }
const SUB = (o) => P({ id: "p9", kind: "sub_agent", title: "New sub-agent", payload: { sub_agent: RECORD, approval: { approve: "/api/agents/sub/s3/approve", reject: "/api/agents/sub/s3/reject" } }, ...o })

beforeEach(() => vi.clearAllMocks())

describe("an approval card under a reply (A1)", () => {
  it("waits for the owner, says who proposes it and who makes it", () => {
    render(<ReplyProposals proposals={[P()]} onUpdate={vi.fn()} />)
    const card = screen.getByRole("group", { name: "Proposal: Put the old lead form back" })
    expect(card).toHaveTextContent("Marketing Guru proposes")
    expect(card).toHaveTextContent("Waiting for you")
    expect(card).toHaveTextContent("Lead form: v2 → v1")
    expect(card).toHaveTextContent("Marketing Guru makes the change")
  })

  it("approving hands it to the owning agent and keeps a receipt with a link to its chat", async () => {
    calls.apply.mockResolvedValue({ reply: "Done. I put the old form back on both ad sets.", session_id: "mb-9" })
    const onUpdate = vi.fn()
    render(<ReplyProposals proposals={[P()]} onUpdate={onUpdate} />)
    await userEvent.click(screen.getByRole("button", { name: "Approve" }))
    expect(calls.apply).toHaveBeenCalledWith("p1")
    expect(remember).toHaveBeenCalledWith("buyer", "mb-9")
    expect(onUpdate).toHaveBeenCalledWith("p1", { status: "approved", session_id: "mb-9", receipt: "Done. I put the old form back on both ad sets." })
  })

  it("shows the approved and declined states in one line each", () => {
    render(<ReplyProposals proposals={[P({ status: "approved", session_id: "mb-9", receipt: "Done." }), P({ id: "p2", title: "Raise the budget", status: "dismissed" })]} />)
    expect(screen.getByText(/Approved by you/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Open Marketing Guru’s chat/ })).toHaveAttribute("href", "/media-buyer/chat?client=g0&c=mb-9")
    expect(screen.getByText("Declined")).toBeInTheDocument()
    expect(screen.getByText("Nothing was changed.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull()
  })

  it("declines, and says so when it was already decided elsewhere", async () => {
    calls.dismiss.mockRejectedValue(Object.assign(new Error("x"), { status: 404 }))
    const onUpdate = vi.fn()
    render(<ReplyProposals proposals={[P()]} onUpdate={onUpdate} />)
    await userEvent.click(screen.getByRole("button", { name: "Decline" }))
    expect(calls.dismiss).toHaveBeenCalledWith("p1")
    expect(await screen.findByText("This was already decided somewhere else.")).toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
  })
})

describe("undoing an approved change", () => {
  it("offers Undo only when the server says the change can be undone", () => {
    render(<ReplyProposals proposals={[P({ status: "approved", can_undo: true }), P({ id: "p2", title: "Raise the budget", status: "approved", can_undo: false })]} />)
    expect(screen.getAllByRole("button", { name: /^Undo/ })).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Undo: Put the old lead form back" })).toBeInTheDocument()
  })

  it("undoes it and keeps the owning agent's answer", async () => {
    calls.undo.mockResolvedValue({ reply: "Done. The new form is live again on both ad sets.", session_id: "mb-10" })
    const onUpdate = vi.fn()
    render(<ReplyProposals proposals={[P({ status: "approved", can_undo: true, session_id: "mb-9" })]} onUpdate={onUpdate} />)
    await userEvent.click(screen.getByRole("button", { name: /^Undo/ }))
    expect(calls.undo).toHaveBeenCalledWith("p1")
    expect(onUpdate).toHaveBeenCalledWith("p1", { undone: true, can_undo: false, undo_receipt: "Done. The new form is live again on both ad sets.", session_id: "mb-10" })
  })

  it("shows the server's reason when it can't be undone", async () => {
    calls.undo.mockRejectedValue(Object.assign(new Error("x"), { status: 409, code: "cannot_undo", detail: "The old form was deleted in Meta." }))
    render(<ReplyProposals proposals={[P({ status: "approved", can_undo: true })]} onUpdate={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: /^Undo/ }))
    expect(await screen.findByText("The old form was deleted in Meta.")).toBeInTheDocument()
  })

  it("shows an undone change as undone, with no Undo", () => {
    render(<ReplyProposals proposals={[P({ status: "approved", can_undo: false, undone: true, undo_receipt: "Back as it was." })]} />)
    expect(screen.getByText("Undone")).toBeInTheDocument()
    expect(screen.getByText(/Undone at your request/)).toHaveTextContent("Marketing Guru: “Back as it was.”")
    expect(screen.queryByRole("button", { name: /^Undo/ })).toBeNull()
  })

  it("reads the server's undone and lapsed states after a reload", () => {
    render(<ReplyProposals proposals={[P({ status: "undone", can_undo: false }), P({ id: "p4", title: "Raise the budget", status: "expired" })]} />)
    expect(screen.getByText("Undone")).toBeInTheDocument()
    expect(screen.getByText("Lapsed")).toBeInTheDocument()
    expect(screen.getByText("It lapsed before you decided, so nothing was changed.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull()
  })

  it("names a sub-agent as the proposer when its name came with the proposal", () => {
    render(<ReplyProposals proposals={[P({ proposed_by: "sub:s1", proposed_by_name: "Form checker" }), P({ id: "p3", proposed_by: "sub:s2" })]} />)
    expect(screen.getByText("Form checker proposes")).toBeInTheDocument()
    expect(screen.getByText("Marketing Guru proposes")).toBeInTheDocument()
  })
})

describe("a sub-agent proposal, one question at a time (B3)", () => {
  const card = () => screen.getByRole("group", { name: /Setting up a sub-agent/ })
  const next = () => userEvent.click(within(card()).getByRole("button", { name: "Next" }))

  it("walks name, job, tools, clients, schedule, then confirm, and saves the owner's edits before approving", async () => {
    calls.patch.mockResolvedValue({})
    calls.approve.mockResolvedValue({ ...RECORD, name: "Ad fatigue", status: "active" })
    const onUpdate = vi.fn()
    render(<ReplyProposals proposals={[SUB()]} onUpdate={onUpdate} />)
    expect(screen.getByText("What should it be called?")).toBeInTheDocument()
    const name = screen.getByRole("textbox", { name: "Name" })
    await userEvent.clear(name)
    await userEvent.type(name, "Ad fatigue")
    await next()
    expect(screen.getByText("What should it do?")).toBeInTheDocument()
    await next()
    expect(screen.getByText("Which tools can it use?")).toBeInTheDocument()
    // Only the tools it offered, nothing more.
    expect(within(card()).getAllByRole("checkbox").map((c) => c.textContent)).toEqual(["Ad results", "Frequency by ad"])
    await userEvent.click(within(card()).getByRole("checkbox", { name: "Frequency by ad" }))
    await next()
    expect(screen.getByText("Which clients should it watch?")).toBeInTheDocument()
    expect(within(card()).getByRole("checkbox", { name: "Aura" })).toBeChecked()
    await next()
    expect(screen.getByText("When should it run?")).toBeInTheDocument()
    await next()
    expect(screen.getByText("Ready to create it?")).toBeInTheDocument()
    expect(card()).toHaveTextContent("Ad results")
    expect(card()).not.toHaveTextContent("Frequency by ad")
    await userEvent.click(screen.getByRole("button", { name: "Create Ad fatigue" }))
    expect(calls.patch).toHaveBeenCalledWith("s3", { name: "Ad fatigue", tools: ["ad_insights"] })
    expect(calls.approve).toHaveBeenCalledWith("s3")
    expect(calls.patch.mock.invocationCallOrder[0]).toBeLessThan(calls.approve.mock.invocationCallOrder[0])
    expect(onUpdate).toHaveBeenCalledWith("p9", expect.objectContaining({ status: "approved" }))
  })

  it("approves without a PATCH when nothing was changed", async () => {
    calls.approve.mockResolvedValue({ ...RECORD, status: "active" })
    render(<ReplyProposals proposals={[SUB()]} onUpdate={vi.fn()} />)
    for (let i = 0; i < 5; i++) await next()
    await userEvent.click(screen.getByRole("button", { name: "Create Fatigue watcher" }))
    expect(calls.patch).not.toHaveBeenCalled()
    expect(calls.approve).toHaveBeenCalledWith("s3")
  })

  it("won't move on from a step that can't be saved", async () => {
    render(<ReplyProposals proposals={[SUB()]} onUpdate={vi.fn()} />)
    await next()
    await next()
    for (const c of within(card()).getAllByRole("checkbox")) await userEvent.click(c)
    await next()
    expect(screen.getByText("Which tools can it use?")).toBeInTheDocument()
    expect(screen.getByText("Pick at least one tool.")).toBeInTheDocument()
  })

  it("declines with reject", async () => {
    calls.reject.mockResolvedValue({})
    const onUpdate = vi.fn()
    render(<ReplyProposals proposals={[SUB()]} onUpdate={onUpdate} />)
    await userEvent.click(within(card()).getByRole("button", { name: "Decline" }))
    expect(calls.reject).toHaveBeenCalledWith("s3")
    expect(onUpdate).toHaveBeenCalledWith("p9", { status: "dismissed" })
  })

  it("once decided, shrinks to one line", () => {
    render(<ReplyProposals proposals={[SUB({ status: "approved", payload: { sub_agent: { ...RECORD, status: "active" } } }), SUB({ id: "p8", status: "dismissed" })]} />)
    expect(screen.getByRole("link", { name: /See it in Context/ })).toHaveAttribute("href", "/media-buyer/context#sub-agents")
    expect(screen.getByText("Declined. Nothing was saved.")).toBeInTheDocument()
  })
})
