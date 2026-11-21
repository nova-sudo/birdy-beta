import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"

// The lead view, against the lead endpoints answered here. No request in these
// tests is a write except where a test presses Send itself.

vi.mock("next/navigation", () => ({ useParams: () => ({ contactId: "c1" }), useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { LeadView } from "../lead-view"
import LeadPage from "@/app/contacts/[contactId]/page"

const DETAIL = {
  contact: {
    id: "c1", name: "Rebecca Stone", first_name: "Rebecca", last_name: "Stone", email: "rebecca@example.com", phone: "07000 000001",
    tags: ["fb lead form", "engaged", "spicy lead", "a", "b"], source: "facebook", date_added: "2026-07-17T10:00:00+00:00",
    location_id: "loc1", group_id: "g1", group_name: "North Clinic", type: "lead",
  },
  opportunities: [{ id: "o1", status: "open", monetary_value: 0, pipeline_name: "Leads", stage_name: "Spicy Leads" }],
  attribution: {
    platform: "fb", is_organic: false, ad_id: "a1", ad_name: "Body Sculpt voucher", adset_name: "Women 25-45", campaign_name: "Body Sculpt July",
    creative_body: "Sculpt like a pro.", creative_image: "https://cdn.example.com/a.jpg", submitted_at: "2026-07-17T09:58:00+00:00",
    form_answers: [{ question: "Best time to call?", answer: "Afternoon" }],
  },
  calls: [
    { id: "call1", source: "hotprospector", direction: "outbound", status: "completed", duration_seconds: 36, started_at: "2026-07-17T15:44:00+00:00", recording_url: "https://example.com/rec.mp3", transcript: "Hi Rebecca, it's about the price." },
  ],
  engagement: { dials: 1, calls: 1, answered: 1, time_to_close_seconds: null, touchpoints: 1 },
}
const MESSAGES = {
  status: "ok",
  messages: [
    { id: "m1", channel: "SMS", direction: "inbound", body: "What is the price?", subject: null, date: "2026-07-17T12:00:00+00:00", attachments: [] },
    { id: "m2", channel: "Email", direction: "outbound", body: "Here it is", subject: "Your quote", date: "2026-07-18T09:00:00+00:00", attachments: [] },
  ],
  calls: [
    { id: "ghl:g1", ghl_message_id: "g1", source: "ghl", direction: "inbound", status: "completed", duration_seconds: 20, started_at: "2026-07-18T11:00:00+00:00", recording_url: null },
  ],
}
const JOURNEY = { events: [{ id: "e1", kind: "stage", title: "Opportunity created", detail: "Leads", at: "2026-07-17T10:01:00+00:00" }], ghl: "reconnect" }

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, blob: async () => new Blob(["x"]) })
let routes
beforeEach(() => {
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => "blob:rec")
  globalThis.URL.revokeObjectURL = vi.fn()
  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
  routes = {
    "/api/leads/contact/c1": () => json(DETAIL),
    "/api/leads/contact/c1/messages": () => json(MESSAGES),
    "/api/leads/contact/c1/journey": () => json(JOURNEY),
    "/api/leads/contact/c1/summary": () => json({ status: "ok", summary: "Rebecca asked about price.", generated_at: new Date().toISOString(), stale: false }),
    "/api/leads/contact/c1/calls/g1/recording": () => json({}),
    "/api/leads/contact/c1/calls/g1/transcript": () => json({ transcript: "Calling back about a refund." }),
  }
  apiRequest.mockImplementation(async (path, opts) => {
    const method = opts?.method && opts.method !== "GET" ? opts.method : null
    const route = routes[method ? `${method} ${path}` : path]
    if (method && !route) throw new Error(`Unexpected write: ${method} ${path}`)
    if (!route) throw new Error(`Unmocked ${path}`)
    return route()
  })
})

const writes = () => apiRequest.mock.calls.filter(([, o]) => o?.method && o.method !== "GET")
const ready = () => screen.findByRole("heading", { name: "Rebecca Stone", level: 1 })

describe("LeadView", () => {
  it("draws the header, the tiles and the conversation from the API", async () => {
    render(<LeadView contactId="c1" />)
    await ready()
    // A call was made, so the lead sits at Called, as its row in the Leads table does.
    expect(screen.getByText("Called")).toBeInTheDocument()
    expect(screen.getByText("Spicy Leads")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /North Clinic leads/ })).toHaveAttribute("href", "/dashboard/table?client=g1")
    expect(screen.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:07000 000001")
    const figures = screen.getByRole("group", { name: "Lead figures" })
    expect(within(figures).getByText("Open for")).toBeInTheDocument()
    expect(within(figures).getByText("If won")).toBeInTheDocument()

    expect(await screen.findByText("What is the price?")).toBeInTheDocument()
    expect(screen.getByText("Your quote")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "All, 4" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Messages, 2" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Calls, 2" })).toBeInTheDocument()
    expect(await screen.findByText("Rebecca asked about price.")).toBeInTheDocument()
    expect(writes()).toEqual([])
  })

  it("on a lead that is gone, says so instead of offering a retry", async () => {
    routes["/api/leads/contact/c1"] = () => json({ detail: "Lead not found" }, 404)
    render(<LeadView contactId="c1" />)
    expect(await screen.findByText("This lead isn’t in Birdy anymore")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
  })

  it("on a failure, offers a retry that loads it again", async () => {
    let fail = true
    routes["/api/leads/contact/c1"] = () => (fail ? json({}, 500) : json(DETAIL))
    render(<LeadView contactId="c1" />)
    const retry = await screen.findByRole("button", { name: "Retry" })
    fail = false
    await userEvent.click(retry)
    await ready()
  })

  it("filters the conversation to calls and back", async () => {
    const user = userEvent.setup()
    render(<LeadView contactId="c1" />)
    await screen.findByText("What is the price?")
    await user.click(screen.getByRole("button", { name: "Calls, 2" }))
    expect(screen.queryByText("What is the price?")).toBeNull()
    expect(screen.getByText("Outbound · 36s")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Messages, 2" }))
    expect(screen.queryByText("Outbound · 36s")).toBeNull()
  })

  it("searches the conversation, transcripts included, and steps through the matches", async () => {
    const user = userEvent.setup()
    render(<LeadView contactId="c1" />)
    await screen.findByText("What is the price?")
    await user.click(screen.getByRole("button", { name: "Search this conversation" }))
    await user.type(screen.getByRole("textbox", { name: "Search this conversation" }), "price")
    expect(await screen.findByText("1 of 2")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Next match" }))
    expect(screen.getByText("2 of 2")).toBeInTheDocument()
    // The second match is in a closed transcript: it opens.
    expect(screen.getByRole("button", { name: /Transcript/, expanded: true })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByText("2 of 2")).toBeNull()
  })

  it("fetches the journey only when its tab opens, and notes a GoHighLevel reconnect", async () => {
    const user = userEvent.setup()
    render(<LeadView contactId="c1" />)
    await ready()
    expect(apiRequest.mock.calls.some(([p]) => p.endsWith("/journey"))).toBe(false)
    await user.click(screen.getByRole("tab", { name: "Journey" }))
    expect(await screen.findByText("Opportunity created")).toBeInTheDocument()
    expect(screen.getByText(/Reconnect GoHighLevel to include appointments/)).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Profile" }))
    await user.click(screen.getByRole("tab", { name: "Journey" }))
    expect(apiRequest.mock.calls.filter(([p]) => p.endsWith("/journey"))).toHaveLength(1)
  })

  it("Calls tab: sums the calls and marks the one picked in the thread", async () => {
    const user = userEvent.setup()
    render(<LeadView contactId="c1" />)
    await screen.findByText("What is the price?")
    await user.click(screen.getByRole("tab", { name: "Calls" }))
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByText("2 of 2")).toBeInTheDocument()
    expect(within(panel).getByText("1 in · 1 out")).toBeInTheDocument()
    expect(within(panel).getByText("56s")).toBeInTheDocument()
    const row = within(panel).getByRole("button", { name: /Inbound · 20s/ })
    await user.click(row)
    expect(row).toHaveAttribute("aria-current", "true")
  })

  it("Ads tab: the source ad, its creative and the form answers", async () => {
    const user = userEvent.setup()
    render(<LeadView contactId="c1" />)
    await ready()
    await user.click(screen.getByRole("tab", { name: "Ads" }))
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByText("Meta · Facebook")).toBeInTheDocument()
    expect(within(panel).getByText("Body Sculpt voucher")).toBeInTheDocument()
    expect(within(panel).getByText("Afternoon")).toBeInTheDocument()
    await user.click(within(panel).getByRole("button", { name: /Enlarge the ad creative/ }))
    expect(await screen.findByRole("dialog", { name: "Ad creative" })).toBeInTheDocument()
  })

  it("plays a GoHighLevel recording only when Play is pressed", async () => {
    const user = userEvent.setup()
    render(<LeadView contactId="c1" />)
    await screen.findByText("Inbound · 20s")
    expect(apiRequest.mock.calls.some(([p]) => p.endsWith("/recording"))).toBe(false)
    await user.click(screen.getByRole("button", { name: "Play recording: Inbound · 20s" }))
    await waitFor(() => expect(document.querySelector('audio[src="blob:rec"]')).not.toBeNull())
    expect(apiRequest).toHaveBeenCalledWith("/api/leads/contact/c1/calls/g1/recording")
  })

  it("says to reconnect when the messages need GoHighLevel, and keeps Send off", async () => {
    routes["/api/leads/contact/c1/messages"] = () => json({ status: "reconnect", messages: [], calls: [] })
    render(<LeadView contactId="c1" />)
    expect(await screen.findByText(/Reconnect GoHighLevel in Settings/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
  })

  it("offers a retry when the messages fail", async () => {
    let fail = true
    routes["/api/leads/contact/c1/messages"] = () => (fail ? json({}, 502) : json(MESSAGES))
    const user = userEvent.setup()
    render(<LeadView contactId="c1" />)
    await user.click(await screen.findByRole("button", { name: "Try again" }))
    fail = false
    await user.click(await screen.findByRole("button", { name: "Try again" }))
    expect(await screen.findByText("What is the price?")).toBeInTheDocument()
  })

  it("Message focuses the composer and sends nothing", async () => {
    const user = userEvent.setup()
    render(<LeadView contactId="c1" />)
    await screen.findByText("What is the price?")
    await user.click(screen.getByRole("button", { name: "Message" }))
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveFocus()
    expect(writes()).toEqual([])
  })

  it("a sent message joins the thread", async () => {
    const user = userEvent.setup()
    render(<LeadView contactId="c1" />)
    await screen.findByText("What is the price?")
    routes["POST /api/leads/contact/c1/messages"] = () => json({ message: { id: "m9", channel: "SMS", direction: "outbound", body: "See you then", date: "2026-07-18T12:00:00+00:00", attachments: [] } }, 201)
    await user.type(screen.getByRole("textbox", { name: "Message" }), "See you then")
    expect(writes()).toEqual([])
    await user.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(""))
    expect(within(screen.getByRole("region", { name: "Conversation" })).getByText("See you then")).toBeInTheDocument()
    expect(apiRequest.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(1)
  })

  it("embedded in the modal there is no back link", async () => {
    render(<LeadView contactId="c1" embed />)
    await ready()
    expect(screen.queryByRole("link", { name: /leads$/ })).toBeNull()
  })
})

describe("the lead page", () => {
  it("renders the lead at its address", async () => {
    render(<LeadPage />)
    await ready()
  })
})
