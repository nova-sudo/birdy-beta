// Saved views from chat: hub tables remember their columns for Birdy, the
// chat sends them, and a view Birdy saves lands on the open table.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
vi.mock("@/lib/jobs-store", () => ({ startJob: vi.fn(), finishJob: vi.fn() }))
vi.mock("@/lib/ask-birdy", () => ({ openBirdyChat: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { readViewCatalogues, useRememberViewCatalogue, announceViewOps } = await import("@/lib/view-catalogues")
const { usePageViews } = await import("@/lib/usePageViews")
const { sendChatMessage, getChat } = await import("@/lib/chat-store")
const { default: MessageBubble } = await import("@/components/chat/MessageBubble")

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const view = { id: "v9", name: "Hot leads", state: { visibleColumns: ["tag_hot", "name"], source: "all" } }
const op = (extra) => ({ type: "view_created", page: "contacts", page_label: "Leads Hub", path: "/contacts", view, made_default: false, ...extra })

beforeEach(() => {
  apiRequest.mockReset()
  window.localStorage.clear()
})

describe("useRememberViewCatalogue", () => {
  it("keeps each page's columns, trimmed to what Birdy needs", () => {
    const columns = [{ id: "name", label: "Name", source: "meta", extra: 1 }, { id: "tag_hot", label: <b>hot</b> }]
    const { rerender } = renderHook(({ cols }) =>
      useRememberViewCatalogue("contacts", { label: "Leads Hub", path: "/contacts", columns: cols }),
    { initialProps: { cols: columns } })
    renderHook(() => useRememberViewCatalogue("clients", { label: "Clients Hub", path: "/clients", columns: [{ id: "spend", label: "Spend" }] }))

    expect(readViewCatalogues()).toEqual({
      contacts: { label: "Leads Hub", path: "/contacts", columns: [{ id: "name", label: "Name", source: "meta" }, { id: "tag_hot", label: "tag_hot" }] },
      clients: { label: "Clients Hub", path: "/clients", columns: [{ id: "spend", label: "Spend" }] },
    })

    // A fresh array with the same content does not rewrite storage.
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    rerender({ cols: columns.map((c) => ({ ...c })) })
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

  it("saves each list to the account once, until the columns change", async () => {
    apiRequest.mockResolvedValue({ ok: true, status: 200 })
    const entry = (cols) => ({ label: "Clients Hub", path: "/clients", columns: cols })
    const { unmount } = renderHook(({ cols }) => useRememberViewCatalogue("clients", entry(cols)),
      { initialProps: { cols: [{ id: "spend", label: "Spend" }] } })
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1))
    expect(apiRequest.mock.calls[0][0]).toBe("/api/user/view-catalogues/clients")
    expect(JSON.parse(apiRequest.mock.calls[0][1].body)).toEqual(entry([{ id: "spend", label: "Spend" }]))
    unmount()

    // A later visit with the same columns writes nothing; a new column does.
    renderHook(() => useRememberViewCatalogue("clients", entry([{ id: "spend", label: "Spend" }])))
    await new Promise((r) => setTimeout(r, 0))
    expect(apiRequest).toHaveBeenCalledTimes(1)
    renderHook(() => useRememberViewCatalogue("clients", entry([{ id: "spend", label: "Spend" }, { id: "cpl", label: "CPL" }])))
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
  })

  it("survives storage that throws", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked") })
    expect(readViewCatalogues()).toEqual({})
    getItem.mockRestore()
  })
})

describe("a view Birdy saved", () => {
  it("is added to the open table's picker and applied", async () => {
    apiRequest.mockResolvedValueOnce(ok({ views: [], default_view_id: null }))
    const onApply = vi.fn()
    const { result } = renderHook(() => usePageViews("contacts", { onApply }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    const other = op({ page: "clients" })
    const mine = op()
    act(() => announceViewOps([other, mine]))

    expect(result.current.views).toEqual([view])
    expect(result.current.activeViewId).toBe("v9")
    expect(result.current.defaultViewId).toBe("v9")
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith(view.state)
    expect(mine.applied).toBe(true)
    expect(other.applied).toBeUndefined()
  })

  it("goes out with every chat message's column lists and comes back on the reply", async () => {
    window.localStorage.setItem("birdy_view_catalogues", JSON.stringify({ contacts: { label: "Leads Hub", columns: [] } }))
    const listener = vi.fn()
    window.addEventListener("birdy:view-created", listener)
    apiRequest.mockResolvedValueOnce(ok({ reply: "Saved.", tools_used: ["create_saved_view"], page_view_ops: [op()] }))

    await sendChatMessage("views-1", { text: "make a view" })

    expect(JSON.parse(apiRequest.mock.calls[0][1].body).view_catalogues).toEqual({ contacts: { label: "Leads Hub", columns: [] } })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getChat("views-1").messages.at(-1).page_view_ops).toEqual([op()])
    window.removeEventListener("birdy:view-created", listener)
  })

  it("shows a receipt with a link when not applied, and Undo deletes it", async () => {
    apiRequest.mockResolvedValueOnce({ ok: true, status: 200 })
    const removed = vi.fn()
    window.addEventListener("birdy:view-removed", removed)
    render(<MessageBubble message={{ role: "assistant", content: "Done.", tools_used: [], page_view_ops: [op()] }} messageIndex={1} />)

    const receipt = screen.getByRole("status", { name: 'Saved "Hot leads" on Leads Hub' })
    expect(receipt).toHaveTextContent("2 columns")
    expect(screen.getByRole("link", { name: "Open Leads Hub" })).toHaveAttribute("href", "/contacts")

    await userEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(apiRequest).toHaveBeenCalledWith("/api/user/page-views/v9?page=contacts", { method: "DELETE" })
    expect(await screen.findByText("Undone")).toBeInTheDocument()
    expect(removed).toHaveBeenCalledTimes(1)
    window.removeEventListener("birdy:view-removed", removed)
  })

  it("says it was applied when the table took it", () => {
    render(<MessageBubble message={{ role: "assistant", content: "Done.", tools_used: [], page_view_ops: [op({ applied: true, made_default: true })] }} messageIndex={1} />)
    expect(screen.getByRole("status")).toHaveTextContent("2 columns · opens by default. Applied to the table.")
    expect(screen.queryByRole("link")).toBeNull()
  })
})
