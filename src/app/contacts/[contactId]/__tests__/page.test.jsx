import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Lead detail page ───────────────────────────────────────────────────────
// One lead from the Leads hub: a tabbed profile panel on the left (Profile,
// Journey, Calls, Ads) and the thread (calls and GHL messages) with its composer on the right.

let routeParams = { contactId: "c1" }
vi.mock("next/navigation", () => ({
  useParams: () => routeParams,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))

import { apiRequest } from "@/lib/api"
import LeadDetailPage from "../page"

const DETAIL = {
  contact: {
    id: "c1",
    name: "Rebecca Becirspahic",
    first_name: "Rebecca",
    last_name: "Becirspahic",
    email: "becirspahicwedding@gmail.com",
    phone: "07393 421825",
    tags: ["fb lead form", "engaged - sms", "spicy lead", "a", "b"],
    source: "facebook",
    date_added: "2026-07-17T10:00:00+00:00",
    assigned_to: null,
    location_id: "loc1",
    group_id: "g1",
    group_name: "BBL Lanarkshire",
    type: "lead",
  },
  opportunities: [
    {
      id: "o1",
      status: "open",
      monetary_value: 0,
      pipeline_name: "Leads",
      stage_name: "Spicy Leads",
      created_at: "2026-07-17T10:00:00+00:00",
      last_status_change_at: null,
    },
  ],
  attribution: {
    platform: "facebook",
    is_organic: false,
    ad_id: "a1",
    ad_name: "Celebrity Body Sculpt voucher",
    adset_name: "Women 25-45",
    campaign_name: "Body Sculpt July",
    campaign_id: "camp1",
    creative_title: null,
    creative_body: "Sculpt like a celebrity.",
    creative_image: null,
    creative_thumbnail: null,
    submitted_at: "2026-07-17T09:58:00+00:00",
    form_answers: [{ question: "Best time to call?", answer: "Afternoon" }],
    utm: {},
  },
  calls: [
    {
      id: "call1",
      source: "ghl",
      direction: "outbound",
      status: "completed",
      duration_seconds: 36,
      started_at: "2026-07-17T15:44:00+00:00",
      recording_url: "https://example.com/rec.mp3",
      transcript: "Hi Rebecca, it's Emma.",
    },
  ],
  engagement: { dials: 1, calls: 1, answered: 1, time_to_close_seconds: null, touchpoints: 1 },
}

beforeEach(() => {
  vi.clearAllMocks()
  routeParams = { contactId: "c1" }
})

const MESSAGES = {
  status: "ok",
  messages: [
    {
      id: "m1",
      channel: "SMS",
      direction: "inbound",
      body: "Can you ring me tomorrow?",
      subject: null,
      status: "delivered",
      date: "2026-07-17T16:00:00+00:00",
      attachments: [],
      source: "app",
    },
  ],
}

// The detail and the messages are separate requests; answer each by URL.
function respond(body, status = 200, messages = MESSAGES) {
  vi.mocked(apiRequest).mockImplementation(async (url) => {
    const isMessages = String(url).endsWith("/messages")
    if (isMessages && messages instanceof Error) throw messages
    const [data, code] = isMessages ? [messages, 200] : [body, status]
    return { ok: code >= 200 && code < 300, status: code, json: async () => data }
  })
}

describe("lead detail page", () => {
  it("fetches one summary per lead, and not for a new lead until its detail resolves", async () => {
    const summaryCalls = () => vi.mocked(apiRequest).mock.calls.map(([u]) => String(u)).filter((u) => u.endsWith("/summary"))
    let resolveC2
    vi.mocked(apiRequest).mockImplementation(async (url) => {
      const u = String(url)
      const json = (data) => ({ ok: true, status: 200, json: async () => data })
      if (u.endsWith("/summary")) return json({ status: "ok", summary: "S", generated_at: null, stale: false })
      if (u.endsWith("/messages")) return json(MESSAGES)
      if (u.endsWith("/c2")) return new Promise((resolve) => { resolveC2 = () => resolve(json({ ...DETAIL, contact: { ...DETAIL.contact, id: "c2" } })) })
      return json(DETAIL)
    })
    const { rerender } = render(<LeadDetailPage />)
    await screen.findByRole("heading", { name: "Rebecca Becirspahic" })
    await waitFor(() => expect(summaryCalls()).toEqual(["/api/leads/contact/c1/summary"]))

    routeParams = { contactId: "c2" }
    rerender(<LeadDetailPage />)
    await waitFor(() => expect(vi.mocked(apiRequest).mock.calls.some(([u]) => String(u).endsWith("/c2"))).toBe(true))
    expect(summaryCalls()).toEqual(["/api/leads/contact/c1/summary"])

    resolveC2()
    await waitFor(() => expect(summaryCalls()).toEqual([
      "/api/leads/contact/c1/summary", "/api/leads/contact/c2/summary"]))
  })

  it("shows the lead's name and the Profile tab's phone", async () => {
    respond(DETAIL)
    render(<LeadDetailPage />)

    expect(await screen.findByRole("heading", { name: "Rebecca Becirspahic" })).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledWith("/api/leads/contact/c1")
    expect(screen.getByText("07393 421825")).toBeInTheDocument()
    expect(screen.getByText("Meta · Celebrity Body Sculpt voucher")).toBeInTheDocument()
    // Three tags, then the rest folded into "+N".
    expect(screen.getByText("+2")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Journey" })).toBeInTheDocument()
  })

  it("lists calls on the Calls tab with a player and transcript", async () => {
    respond(DETAIL)
    const user = userEvent.setup()
    const { container } = render(<LeadDetailPage />)

    await user.click(await screen.findByRole("tab", { name: "Calls" }))
    expect(screen.getByText("Outbound · completed")).toBeInTheDocument()
    const panel = container.querySelector("#lead-profile-panel")
    await user.click(within(panel).getByRole("button", { name: "Play recording" }))
    expect(container.querySelector('audio[src="https://example.com/rec.mp3"]')).not.toBeNull()
    expect(screen.getAllByText("Transcript").length).toBeGreaterThan(0)
  })

  it("shows the source ad on the Ads tab", async () => {
    respond(DETAIL)
    const user = userEvent.setup()
    render(<LeadDetailPage />)

    await user.click(await screen.findByRole("tab", { name: "Ads" }))
    expect(screen.getByText("Body Sculpt July")).toBeInTheDocument()
    expect(screen.getByText("Best time to call?")).toBeInTheDocument()
    expect(screen.getByText("Afternoon")).toBeInTheDocument()
  })

  it("interleaves calls and messages in the thread", async () => {
    respond(DETAIL)
    render(<LeadDetailPage />)

    expect(await screen.findByText("Outbound call · completed")).toBeInTheDocument()
    expect(await screen.findByText("Can you ring me tomorrow?")).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledWith("/api/leads/contact/c1/messages")
    expect(screen.getByPlaceholderText("Type a message…")).toBeInTheDocument()
  })

  it("counts messages in the engagement block", async () => {
    respond(DETAIL)
    render(<LeadDetailPage />)

    await screen.findByText("Can you ring me tomorrow?")
    expect(screen.getByText("Messages").nextSibling).toHaveTextContent("1")
    // 1 call + 1 message, in the header's figure strip
    expect(screen.getByText("Touchpoints").nextSibling).toHaveTextContent("2")
  })

  it("holds the whole thread back until the messages and GHL calls arrive", async () => {
    let resolveMessages
    vi.mocked(apiRequest).mockImplementation(async (url) => {
      const json = (data) => ({ ok: true, status: 200, json: async () => data })
      if (String(url).endsWith("/messages")) return new Promise((resolve) => { resolveMessages = () => resolve(json(MESSAGES)) })
      return json(DETAIL)
    })
    render(<LeadDetailPage />)

    await screen.findByRole("heading", { name: "Rebecca Becirspahic" })
    const thread = screen.getByRole("region", { name: "Conversation" })
    expect(within(thread).getByText("Loading the conversation…")).toBeInTheDocument()
    // The logged call is known already, but the thread waits for everything.
    expect(within(thread).queryByText("Outbound call · completed")).toBeNull()

    resolveMessages()
    expect(await within(thread).findByText("Can you ring me tomorrow?")).toBeInTheDocument()
    expect(within(thread).getByText("Outbound call · completed")).toBeInTheDocument()
  })

  it("adds GHL calls to the thread and the counts, playable on demand", async () => {
    const ghlCall = {
      id: "ghl:m9", ghl_message_id: "m9", source: "ghl", direction: "outbound", status: "completed",
      duration_seconds: 30, started_at: MESSAGES.messages[0].date, recording_url: null,
    }
    respond(DETAIL, 200, { ...MESSAGES, calls: [ghlCall] })
    render(<LeadDetailPage />)

    await screen.findByText("Can you ring me tomorrow?")
    expect(screen.getAllByText("Outbound call · completed")).toHaveLength(2)
    // The logged call and the GHL call get the same button.
    expect(screen.getAllByRole("button", { name: "Play recording" })).toHaveLength(2)
    // 2 calls + 1 message
    expect(screen.getByText("Touchpoints").nextSibling).toHaveTextContent("3")
    expect(vi.mocked(apiRequest).mock.calls.some(([u]) => String(u).includes("/recording"))).toBe(false)
  })

  it("says to reconnect and disables the composer when GHL needs it, leaving the page intact", async () => {
    respond(DETAIL, 200, { status: "reconnect", messages: [] })
    render(<LeadDetailPage />)

    expect(await screen.findByText(/Reconnect GoHighLevel in Settings/)).toBeInTheDocument()
    expect(screen.getByText("Outbound call · completed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled()
  })

  it("keeps the page when the messages request fails, and retries", async () => {
    respond(DETAIL, 200, new Error("network"))
    const user = userEvent.setup()
    render(<LeadDetailPage />)

    expect(await screen.findByText(/Messages couldn't be loaded/)).toBeInTheDocument()
    expect(screen.getByText("Outbound call · completed")).toBeInTheDocument()
    respond(DETAIL)
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Can you ring me tomorrow?")).toBeInTheDocument()
  })

  it("appends a sent message to the thread", async () => {
    respond(DETAIL)
    const sent = {
      id: "m2", channel: "SMS", direction: "outbound", body: "Tomorrow at 10", subject: null,
      status: "sent", date: "2026-07-17T17:00:00+00:00", attachments: [], source: "app",
    }
    const base = vi.mocked(apiRequest).getMockImplementation()
    vi.mocked(apiRequest).mockImplementation(async (url, opts) =>
      opts?.method === "POST" ? { ok: true, status: 201, json: async () => ({ message: sent }) } : base(url, opts)
    )
    const user = userEvent.setup()
    render(<LeadDetailPage />)

    await screen.findByText("Can you ring me tomorrow?")
    await user.type(screen.getByPlaceholderText("Type a message…"), "Tomorrow at 10")
    await user.click(screen.getByRole("button", { name: /^send$/i }))
    expect(await screen.findAllByText("Tomorrow at 10")).not.toHaveLength(0)
    expect(screen.getByPlaceholderText("Type a message…")).toHaveValue("")
  })

  it("says the lead is gone when the API answers 404", async () => {
    respond({ detail: "Lead not found" }, 404)
    render(<LeadDetailPage />)

    expect(await screen.findByText("This lead isn't in Birdy anymore")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /back to leads/i })).toHaveAttribute("href", "/contacts")
  })

  it("treats a rejected request carrying status 404 as not found", async () => {
    vi.mocked(apiRequest).mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }))
    render(<LeadDetailPage />)

    expect(await screen.findByText("This lead isn't in Birdy anymore")).toBeInTheDocument()
  })

  it("offers a retry when the request fails", async () => {
    respond({ detail: "boom" }, 500)
    const user = userEvent.setup()
    render(<LeadDetailPage />)

    expect(await screen.findByText("Couldn\u2019t load this lead")).toBeInTheDocument()
    await user.click(await screen.findByRole("button", { name: /try again/i }))
    expect(apiRequest.mock.calls.filter(([u]) => u === "/api/leads/contact/c1")).toHaveLength(2)
  })

  it("notes partial and truncated message lists", async () => {
    respond(DETAIL, 200, { ...MESSAGES, partial: true })
    const { unmount } = render(<LeadDetailPage />)
    expect(await screen.findByText("Some messages couldn't be loaded.")).toBeInTheDocument()
    unmount()
    respond(DETAIL, 200, { ...MESSAGES, truncated: true })
    render(<LeadDetailPage />)
    expect(await screen.findByText("Showing the most recent messages.")).toBeInTheDocument()
  })
})
