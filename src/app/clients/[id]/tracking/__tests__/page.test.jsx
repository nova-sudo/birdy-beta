import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Tracking setup, per lead source ────────────────────────────────────────
// A client on a form tool that sends to GoHighLevel (ROAS Forms on its own
// pages or embedded) has nothing to install in Birdy — the attribution travels
// through GHL. Only a client's own landing page with its own records walks the
// pixel steps.

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "g1" }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))

import { apiRequest } from "@/lib/api"
import TrackingPortalPage from "../page"

function portal(method, extra = {}) {
  return {
    group_id: "g1",
    group_name: "Glow Clinic",
    site_id: "s1",
    lead_collection: { method, form_provider: null, push_to_ghl: false, ...extra },
    snippet: '<script async src="https://t.example/t/s1.js"></script>',
    meta_url_parameters: "utm_source=facebook&ad_id={{ad.id}}",
    install_page_url: "https://app.example/install/s1",
    diagnostics: method === "instant_form"
      ? { applicable: false, complete: true, stages: [], next_step: null }
      : method === "form_to_ghl"
        ? {
            applicable: true, complete: false, next_step: "ghl_contacts_attributed",
            stages: [
              { key: "ghl_contacts_arriving", label: "Leads arriving in GoHighLevel", done: true, hint: "" },
              { key: "ghl_contacts_attributed", label: "Leads carry the ad they came from", done: false, hint: "Turn on sending attribution in ROAS Forms." },
            ],
          }
        : { applicable: true, complete: false, next_step: "script_installed", stages: [] },
  }
}

let current
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockImplementation((url, opts = {}) => {
    if (opts.method === "PUT") {
      const body = JSON.parse(opts.body)
      current = portal(body.method, { form_provider: body.form_provider })
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
    }
    return Promise.resolve({ ok: true, json: async () => current })
  })
})

describe("tracking setup", () => {
  it("tells a form-tool client there is nothing to install and shows no pixel steps", async () => {
    current = portal("form_to_ghl")
    render(<TrackingPortalPage />)

    expect(await screen.findByText("Nothing to install in Birdy")).toBeInTheDocument()
    expect(screen.queryByText("Install the pixel")).toBeNull()          // no step rail
    expect(screen.queryByText(/Next: install the pixel/)).toBeNull()
    expect(screen.getByText("Leads carry the ad they came from")).toBeInTheDocument()
    expect(screen.getByText("utm_source=facebook&ad_id={{ad.id}}")).toBeInTheDocument()
  })

  it("explains what to switch on in ROAS Forms once it is picked", async () => {
    current = portal("form_to_ghl")
    const user = userEvent.setup()
    render(<TrackingPortalPage />)

    await user.click(await screen.findByRole("button", { name: "ROAS Forms" }))

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/attribution/lead-collection/g1", expect.objectContaining({ method: "PUT" }))
    )
    const put = vi.mocked(apiRequest).mock.calls.find(([, o]) => o?.method === "PUT")
    expect(JSON.parse(put[1].body)).toMatchObject({ method: "form_to_ghl", form_provider: "roasform" })
    expect(await screen.findByText(/connect the form to this client's GoHighLevel sub-account/)).toBeInTheDocument()
    expect(screen.getByText(/embedded in the client's website/)).toBeInTheDocument()
  })

  it("reads a client still stored as external_form as a form tool", async () => {
    current = portal("external_form")
    render(<TrackingPortalPage />)
    expect(await screen.findByText("Nothing to install in Birdy")).toBeInTheDocument()
  })

  it("walks a landing-page client through installing the pixel", async () => {
    current = portal("landing_page")
    const user = userEvent.setup()
    render(<TrackingPortalPage />)

    await user.click(await screen.findByRole("button", { name: /Next: install the pixel/ }))
    expect(screen.getByText("Install the Birdy pixel")).toBeInTheDocument()
    expect(screen.queryByText("Connect the form")).toBeNull()
    expect(screen.queryByText("Nothing to install in Birdy")).toBeNull()
  })

  it("lists the three options with what each needs", async () => {
    current = portal("unknown")
    render(<TrackingPortalPage />)

    expect(await screen.findByText("Meta Instant Forms")).toBeInTheDocument()
    expect(screen.getByText("A form tool that sends leads to GoHighLevel")).toBeInTheDocument()
    expect(screen.getByText("Their own landing page and records")).toBeInTheDocument()
    expect(screen.getByText(/Needs the Birdy pixel/)).toBeInTheDocument()
  })
})
