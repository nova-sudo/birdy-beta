import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import NewAgentPage from "../page"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const posts = () => vi.mocked(apiRequest).mock.calls.filter(([, init]) => init?.method === "POST")

beforeEach(() => {
  push.mockReset()
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation((path, init = {}) =>
    path === "/api/agents" && init.method === "POST"
      ? Promise.resolve(res({ id: "ag9", type: "custom", name: "Lead rules" }))
      : Promise.resolve(res([]))
  )
})

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <NewAgentPage />
    </SWRConfig>
  )

describe("New custom agent page", () => {
  it("creates a custom agent with the typed name and opens its setup", async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText("Agent name"), "Lead rules")
    await userEvent.click(screen.getByRole("button", { name: /Create agent/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/custom/ag9/setup"))
    expect(posts()).toHaveLength(1)
    expect(posts()[0][0]).toBe("/api/agents")
    expect(JSON.parse(posts()[0][1].body)).toEqual({ type: "custom", name: "Lead rules" })
  })

  it("a blank name shows an inline error and posts nothing", async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText("Agent name"), "   ")
    await userEvent.click(screen.getByRole("button", { name: /Create agent/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Give the agent a name.")
    expect(posts()).toHaveLength(0)
    expect(push).not.toHaveBeenCalled()
  })

  it("shows the server's refusal inline and stays on the page", async () => {
    vi.mocked(apiRequest).mockImplementation((path, init = {}) =>
      init.method === "POST" ? Promise.resolve(res({ detail: "Name is too long" }, 400)) : Promise.resolve(res([]))
    )
    renderPage()
    await userEvent.type(screen.getByLabelText("Agent name"), "x")
    await userEvent.click(screen.getByRole("button", { name: /Create agent/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Name is too long")
    expect(push).not.toHaveBeenCalled()
  })
})
