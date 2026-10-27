import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Lead detail page ───────────────────────────────────────────────────────
// One lead from the Leads hub: a tabbed profile panel on the left (Profile,
// Ads, Calls) and the calls-only thread on the right.

vi.mock("next/navigation", () => ({
  useParams: () => ({ contactId: "c1" }),
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
})

function respond(body, status = 200) {
  vi.mocked(apiRequest).mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

describe("lead detail page", () => {
  it("shows the lead's name and the Profile tab's phone", async () => {
    respond(DETAIL)
    render(<LeadDetailPage />)

    expect(await screen.findByRole("heading", { name: "Rebecca Becirspahic" })).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledWith("/api/leads/contact/c1")
    expect(screen.getByText("07393 421825")).toBeInTheDocument()
    expect(screen.getByText("Meta · Celebrity Body Sculpt voucher")).toBeInTheDocument()
    // Three tags, then the rest folded into "+N".
    expect(screen.getByText("+2")).toBeInTheDocument()
    // Phase 1: no Journey tab.
    expect(screen.queryByRole("tab", { name: "Journey" })).toBeNull()
  })

  it("lists calls on the Calls tab with a player and transcript", async () => {
    respond(DETAIL)
    const user = userEvent.setup()
    const { container } = render(<LeadDetailPage />)

    await user.click(await screen.findByRole("tab", { name: "Calls" }))
    expect(screen.getByText("Outbound · completed")).toBeInTheDocument()
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

  it("puts calls in the thread with the messaging note", async () => {
    respond(DETAIL)
    render(<LeadDetailPage />)

    expect(await screen.findByText("Outbound call · completed")).toBeInTheDocument()
    expect(
      screen.getByText("Messages will appear here once GHL messaging is connected.")
    ).toBeInTheDocument()
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

    await user.click(await screen.findByRole("button", { name: /try again/i }))
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })
})
