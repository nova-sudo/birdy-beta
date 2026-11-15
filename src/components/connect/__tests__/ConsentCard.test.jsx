import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({ API_BASE_URL: "http://api.test" }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))

import ConsentCard from "../ConsentCard"

const json = (status, body) => ({ ok: status < 400, status, json: async () => body })
const REQ = { client_name: "Claude", redirect_host: "claude.ai", requested_access: "read" }

let fetchMock
let assign
const realLocation = window.location
afterEach(() => {
  Object.defineProperty(window, "location", { value: realLocation, writable: true })
})
beforeEach(() => {
  localStorage.setItem("user", JSON.stringify({ email: "you@agency.com" }))
  fetchMock = vi.fn()
  global.fetch = fetchMock
  assign = vi.fn()
  Object.defineProperty(window, "location", { value: { assign }, writable: true })
})

describe("ConsentCard", () => {
  it("renders client name and redirect host", async () => {
    fetchMock.mockResolvedValueOnce(json(200, REQ))
    render(<ConsentCard requestId="r1" />)
    expect(await screen.findByText(/Claude wants to connect to your Birdy account/)).toBeInTheDocument()
    expect(screen.getAllByText("claude.ai").length).toBeGreaterThan(0)
    expect(screen.getByText(/you@agency.com/)).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /View my data/ })).toBeChecked()
  })

  it("uses the shared app logo (Claude is coral, same as Settings)", async () => {
    fetchMock.mockResolvedValueOnce(json(200, REQ))
    const { container } = render(<ConsentCard requestId="r1" />)
    await screen.findByText(/Claude wants to connect/)
    const tile = Array.from(container.querySelectorAll("span[aria-hidden='true']")).find((e) => e.textContent === "C")
    expect(tile).toBeTruthy()
    expect(tile.style.background).toMatch(/rgb\(217, 119, 87\)|#d97757/i)
  })

  it("allow posts chosen access and navigates to redirect_to", async () => {
    fetchMock.mockResolvedValueOnce(json(200, REQ))
    fetchMock.mockResolvedValueOnce(json(200, { redirect_to: "https://claude.ai/cb?code=x" }))
    render(<ConsentCard requestId="r1" />)
    await userEvent.click(await screen.findByRole("radio", { name: /View and make changes/ }))
    await userEvent.click(screen.getByRole("button", { name: "Allow" }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://claude.ai/cb?code=x"))
    const [url, opts] = fetchMock.mock.calls[1]
    expect(url).toBe("http://api.test/api/oauth/requests/r1/decision")
    expect(opts.method).toBe("POST")
    expect(opts.credentials).toBe("include")
    expect(opts.headers["Content-Type"]).toBe("application/json")
    expect(JSON.parse(opts.body)).toEqual({ allow: true, access: "write" })
  })

  it("deny posts allow=false", async () => {
    fetchMock.mockResolvedValueOnce(json(200, REQ))
    fetchMock.mockResolvedValueOnce(json(200, { redirect_to: "https://claude.ai/cb?error=access_denied" }))
    render(<ConsentCard requestId="r1" />)
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(assign).toHaveBeenCalled())
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).allow).toBe(false)
  })

  it("shows expired copy on 404", async () => {
    fetchMock.mockResolvedValueOnce(json(404, { detail: "nope" }))
    render(<ConsentCard requestId="r1" />)
    expect(await screen.findByText(/This connection request expired/)).toBeInTheDocument()
  })

  it("sends a logged-out user to login keeping the request id", async () => {
    fetchMock.mockResolvedValueOnce(json(401, {}))
    render(<ConsentCard requestId="r1" />)
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("/login?redirect=" + encodeURIComponent("/connect/authorize?request=r1")),
    )
  })

  it("shows the server message on 403 and billing copy on 402", async () => {
    fetchMock.mockResolvedValueOnce(json(200, REQ))
    fetchMock.mockResolvedValueOnce(json(403, { detail: "Admin sessions cannot approve." }))
    render(<ConsentCard requestId="r1" />)
    await userEvent.click(await screen.findByRole("button", { name: "Allow" }))
    expect(await screen.findByText("Admin sessions cannot approve.")).toBeInTheDocument()
    fetchMock.mockResolvedValueOnce(json(402, {}))
    await userEvent.click(screen.getByRole("button", { name: "Allow" }))
    expect(await screen.findByText(/active Birdy subscription is needed/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /billing/i })).toHaveAttribute("href", "/settings?tab=billing")
  })

  it("disables Allow, Cancel and the radios while a decision is in flight", async () => {
    fetchMock.mockResolvedValueOnce(json(200, REQ))
    fetchMock.mockReturnValueOnce(new Promise(() => {}))
    render(<ConsentCard requestId="r1" />)
    await userEvent.click(await screen.findByRole("button", { name: "Allow" }))
    expect(screen.getByRole("button", { name: "Allow" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(screen.getByRole("radio", { name: /View my data/ })).toBeDisabled()
  })
})
