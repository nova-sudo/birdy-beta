import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Characterization of the step bodies page.test.jsx does not reach: heading,
// primary button, and the request the primary action makes. Written before the
// wizard was split into steps/ so the split can be shown not to change them.

const push = vi.fn()
const replace = vi.fn()
const router = { push, replace }
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}))

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({
  apiRequest: (...args) => apiRequest(...args),
}))

vi.mock("@/components/birdy/Birdy", () => ({ default: () => null }))
vi.mock("../BillingStep", () => ({ default: () => <div>billing step</div> }))
vi.mock("@/components/report-designer/ReportDesigner", () => ({
  default: () => <div>report designer</div>,
}))

import OnboardingPage from "@/app/onboarding/page"

const json = (body) => Promise.resolve({ ok: true, json: async () => body })
const never = () => new Promise(() => {})

function bootAt(step, { data = {}, overrides = {} } = {}) {
  apiRequest.mockImplementation((url) => {
    if (url in overrides) return overrides[url]()
    if (url === "/api/onboarding/status") return json({ completed: false, step, data })
    if (url === "/api/status") {
      return json({ gohighlevel: { agency: { connected: true } }, facebook: { connected: true } })
    }
    if (url === "/api/integrations/slack/status") return json({ installed: false })
    if (url === "/api/hotprospector/status") return json({ connected: false })
    if (url === "/api/onboarding/state") return json({ ok: true })
    if (url === "/api/onboarding/prepare-review") return json({ ok: true })
    if (url === "/api/onboarding/complete") return json({ ok: true })
    if (url.startsWith("/api/subaccount/locations")) {
      return json({ locations: [{ id: "loc_1", name: "Lizzie Jayne's Beauty" }] })
    }
    if (url.startsWith("/api/facebook/adaccounts")) {
      return json({ data: { data: [{ id: "act_1", name: "Lizzie Ads", currency: "USD" }] } })
    }
    return json({})
  })
  return render(<OnboardingPage />)
}

const PICKED_CLIENT = {
  sales_tool: "ghl",
  first_client: { ghl_location_id: "loc_1", name: "Lizzie Jayne's Beauty" },
}

/** The parsed body of the last PUT /api/onboarding/state call. */
function lastPersisted() {
  const calls = apiRequest.mock.calls.filter(
    ([url, opts]) => url === "/api/onboarding/state" && opts?.method === "PUT"
  )
  return JSON.parse(calls[calls.length - 1][1].body)
}

beforeEach(() => {
  push.mockClear()
  replace.mockClear()
  apiRequest.mockReset()
  localStorage.clear()
})

describe("onboarding steps", () => {
  it("welcome: greets and advances on Get started", async () => {
    const user = userEvent.setup()
    bootAt(0)
    await screen.findByText("Welcome to Birdy!")

    await user.click(screen.getByRole("button", { name: /get started/i }))

    expect(lastPersisted()).toMatchObject({ step: 1, data: { steps_version: 2 } })
    await screen.findByText(/what should we call you/i)
  })

  it("welcome_name: saves the trimmed name", async () => {
    const user = userEvent.setup()
    bootAt(1)
    await screen.findByText(/what should we call you/i)
    expect(screen.getByRole("button", { name: /continue/i }).disabled).toBe(true)

    await user.type(screen.getByPlaceholderText("Your first name"), "  Sam ")
    await user.click(screen.getByRole("button", { name: /continue/i }))

    expect(lastPersisted()).toMatchObject({ step: 2, data: { name: "Sam" } })
  })

  it("agency: addresses the user by name and saves the trimmed agency", async () => {
    const user = userEvent.setup()
    bootAt(2, { data: { name: "Sam" } })
    await screen.findByText(/what's your agency called/i)
    expect(screen.getByText(/show up across birdy, sam/i)).toBeTruthy()

    await user.type(screen.getByPlaceholderText("Agency name"), " Acme ")
    await user.click(screen.getByRole("button", { name: /continue/i }))

    expect(lastPersisted()).toMatchObject({ step: 3, data: { agency: "Acme" } })
  })

  it("connect_ghl: starts the GHL hop from Connect GHL", async () => {
    const user = userEvent.setup()
    bootAt(3, {
      data: { name: "Sam" },
      overrides: {
        "/api/status": () => json({ gohighlevel: { agency: { connected: false } }, facebook: {} }),
        "/api/connect": never,
      },
    })
    await screen.findByText(/great, sam — let's get you connected to ghl/i)

    await user.click(await screen.findByRole("button", { name: /connect ghl/i }))

    expect(apiRequest).toHaveBeenCalledWith("/api/connect")
    await screen.findByText(/connecting to ghl/i)
  })

  it("connect_ghl: shows the connected state and Continue advances the wizard", async () => {
    const user = userEvent.setup()
    bootAt(3)
    await screen.findByText(/ghl connected/i)

    await user.click(screen.getByRole("button", { name: /continue/i }))

    expect(lastPersisted()).toMatchObject({ step: 4 })
    await screen.findByText(/choose your first client/i)
  })

  it("connect_meta: shows the connected state and Continue advances the wizard", async () => {
    const user = userEvent.setup()
    bootAt(5)
    await screen.findByText(/meta connected/i)

    await user.click(screen.getByRole("button", { name: /continue/i }))

    expect(lastPersisted()).toMatchObject({ step: 6 })
    await screen.findByText(/which meta ad account is/i)
  })

  it("client_picker: persists the pick and advances on Continue", async () => {
    const user = userEvent.setup()
    bootAt(4)
    await screen.findByText(/choose your first client/i)
    await screen.findByText("Lizzie Jayne's Beauty")
    expect(screen.getByRole("button", { name: /continue/i }).disabled).toBe(true)

    await user.click(screen.getByText("Lizzie Jayne's Beauty"))
    expect(lastPersisted().data).toEqual({
      first_client: { ghl_location_id: "loc_1", name: "Lizzie Jayne's Beauty" },
    })

    await user.click(screen.getByRole("button", { name: /continue/i }))
    expect(lastPersisted()).toMatchObject({ step: 5 })
  })

  it("connect_meta: starts the Meta hop from Connect Meta", async () => {
    const user = userEvent.setup()
    bootAt(5, {
      overrides: {
        "/api/status": () => json({ gohighlevel: { agency: { connected: true } }, facebook: {} }),
        "/api/connect/facebook": never,
      },
    })
    await screen.findByText(/next up, let's connect meta/i)

    await user.click(await screen.findByRole("button", { name: /connect meta/i }))

    expect(apiRequest).toHaveBeenCalledWith("/api/connect/facebook")
    await screen.findByText(/connecting to meta/i)
  })

  it("meta_ad_picker: persists the full draft with the ad account", async () => {
    const user = userEvent.setup()
    bootAt(6, { data: PICKED_CLIENT })
    await screen.findByText(/which meta ad account is lizzie jayne's beauty/i)
    await screen.findByText("Lizzie Ads")

    await user.click(screen.getByText("Lizzie Ads"))
    expect(lastPersisted().data).toEqual({
      first_client: {
        ghl_location_id: "loc_1",
        name: "Lizzie Jayne's Beauty",
        meta_ad_account_id: "act_1",
        currency: "USD",
      },
    })

    await user.click(screen.getByRole("button", { name: /continue/i }))
    expect(lastPersisted()).toMatchObject({ step: 7 })
  })

  it("hp_key: connects Hot Prospector with the trimmed UID and key", async () => {
    const user = userEvent.setup()
    bootAt(8, {
      data: { sales_tool: "hp" },
      overrides: {
        "/api/hotprospector/connect": () => json({ ok: true }),
      },
    })
    await screen.findByText(/connect your hot prospector account/i)

    await user.type(screen.getByPlaceholderText("API UID"), " uid1 ")
    await user.type(screen.getByPlaceholderText("API key"), " key1 ")
    await user.click(await screen.findByRole("button", { name: /connect hot prospector/i }))

    const call = apiRequest.mock.calls.find(([url]) => url === "/api/hotprospector/connect")
    expect(call[1].method).toBe("POST")
    expect(JSON.parse(call[1].body)).toEqual({ api_uid: "uid1", api_key: "key1" })
    await screen.findByText(/hot prospector connected/i)
  })

  it("client_confirm: sends the complete first-client draft on Confirm", async () => {
    const user = userEvent.setup()
    bootAt(8, { data: PICKED_CLIENT })
    await screen.findByText(/want to change the client name/i)

    const input = screen.getByPlaceholderText("Client name")
    await user.clear(input)
    await user.type(input, "Lizzie Beauty")
    await user.click(screen.getByRole("button", { name: /confirm/i }))

    expect(lastPersisted()).toMatchObject({
      step: 9,
      data: {
        first_client: {
          ghl_location_id: "loc_1",
          name: "Lizzie Beauty",
          meta_ad_account_id: null,
          currency: null,
        },
      },
    })
  })

  it("sync_prompt: congratulates and kicks off the review prep on Continue", async () => {
    const user = userEvent.setup()
    bootAt(10, { data: PICKED_CLIENT, overrides: { "/api/client-groups": never } })
    await screen.findByText(/you connected your first client/i)
    expect(screen.getByText(/lizzie jayne's beauty connected/i)).toBeTruthy()

    await user.click(screen.getByRole("button", { name: /continue onboarding/i }))

    const call = apiRequest.mock.calls.find(([url]) => url === "/api/onboarding/prepare-review")
    expect(call[1]).toEqual({ method: "POST" })
    expect(lastPersisted()).toMatchObject({ step: 11, data: { wants_sync: true } })
  })

  it("kpi_targets: persists the three answers on Apply targets", async () => {
    const user = userEvent.setup()
    bootAt(11, { data: PICKED_CLIENT })
    await screen.findByText(/let's set some targets/i)

    await user.type(screen.getByPlaceholderText("45"), "50")
    await user.type(screen.getByPlaceholderText("20"), "12")
    await user.type(screen.getByPlaceholderText("15"), "9")
    await user.click(screen.getByRole("button", { name: /apply targets/i }))

    expect(lastPersisted()).toMatchObject({
      step: 12,
      data: { kpi: { cpa: "50", wins: "12", conv_rate: "9" } },
    })
    await screen.findByText(/save these as your defaults/i)
  })

  it("completion: greets by name and agency, and finishes through the API", async () => {
    const user = userEvent.setup()
    // No steps_version in the seed, so 19 is read against the old list.
    bootAt(19, {
      data: {
        name: "Sam",
        agency: "Acme",
        first_client: { ...PICKED_CLIENT.first_client, group_id: "grp_1" },
      },
    })
    await screen.findByText(/you're all set, sam/i)
    expect(screen.getByText(/everything birdy just connected for acme/i)).toBeTruthy()

    await user.click(screen.getByRole("button", { name: /take a look at birdy/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/clients/grp_1"))
    const call = apiRequest.mock.calls.find(([url]) => url === "/api/onboarding/complete")
    expect(call[1]).toEqual({ method: "POST" })
  })

  // Token-only styling: nothing left of the retired palette, no pixel-sized
  // type, no inline hex. Rendered rather than grepped so a class assembled at
  // runtime is caught too.
  // Built from parts so the audit grep over this folder stays empty.
  const LEGACY_CLASS = new RegExp(["\\bp", "d-|text-\\[\\d"].join(""))

  it.each([
    ["welcome_name", 1, {}],
    ["connect_ghl", 3, {}],
    ["client_picker", 4, {}],
    ["sales_tool", 7, {}],
    ["client_currency", 9, { data: PICKED_CLIENT }],
    ["kpi_targets", 11, { data: PICKED_CLIENT }],
    ["kpi_default", 12, { data: PICKED_CLIENT }],
    ["slack_connect", 13, {}],
  ])("%s: uses only token classes and no inline hex", async (_name, step, opts) => {
    bootAt(step, opts)
    await screen.findAllByRole("button", { name: /^back$/i })
    await waitFor(() => expect(document.querySelector("[data-ds]")).toBeTruthy())

    for (const el of document.body.querySelectorAll("*")) {
      const cls = el.getAttribute("class") || ""
      expect(cls).not.toMatch(LEGACY_CLASS)
      expect(el.getAttribute("style") || "").not.toContain("#")
    }
  })
})
