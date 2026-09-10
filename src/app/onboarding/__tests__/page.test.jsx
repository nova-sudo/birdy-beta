import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const push = vi.fn()
const replace = vi.fn()
// One stable object, not a fresh one per call: the wizard's boot effect depends
// on `router`, and Next's real useRouter is referentially stable. A mock that
// returns a new object each render re-runs boot on every render, which resets
// stepIndex to the server's value and makes the wizard look like it never
// advances.
const router = { push, replace }
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}))

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({
  apiRequest: (...args) => apiRequest(...args),
}))

// An animated SVG mascot, and a Whop checkout embed that wants a live iframe —
// neither has anything to do with the step machinery under test.
vi.mock("@/components/birdy/Birdy", () => ({ default: () => null }))
// The real step wants a live Whop checkout iframe. The stand-in surfaces the
// props the wizard feeds it, so the count it is told to display can be
// asserted, and offers a way to report a subscription back.
vi.mock("../BillingStep", () => ({
  default: ({ accountCount, onSubscribed, importing }) => (
    <div>
      billing step
      <span data-testid="account-count">{accountCount}</span>
      <span data-testid="importing">{String(importing)}</span>
      <button onClick={onSubscribed}>subscribe</button>
    </div>
  ),
}))
// next/font runs at build time and throws when called outside the Next
// compiler; the wizard only wants the class name off it.
vi.mock("@/lib/pd-fonts", () => ({
  pdFontClass: "font-pd-body",
  poppins: { variable: "" },
  inter: { variable: "" },
}))

import OnboardingPage from "@/app/onboarding/page"

const json = (body) => Promise.resolve({ ok: true, json: async () => body })
const never = () => new Promise(() => {})

/**
 * The wizard resumes from a server-side step index, so every test boots
 * straight onto the step it cares about rather than clicking through twenty of
 * them. `step` is an index into *visibleSteps* — the list after hp_key and the
 * Slack configuration steps have been filtered out — which is exactly what the
 * real /api/onboarding/state persists.
 */
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
    if (url === "/api/onboarding/subaccounts-review") {
      return json({ accounts: [], fb_accounts: [], prep: { status: "done" }, stats: {} })
    }
    if (url.startsWith("/api/subaccount/locations")) {
      return json({ locations: [{ id: "loc_1", name: "Lizzie Jayne's Beauty" }] })
    }
    if (url.startsWith("/api/facebook/adaccounts")) return json({ data: { data: [] } })
    return json({})
  })
  return render(<OnboardingPage />)
}

/** A first client picked and named, as the earlier steps would have left it. */
const PICKED_CLIENT = {
  sales_tool: "ghl",
  first_client: { ghl_location_id: "loc_1", name: "Lizzie Jayne's Beauty" },
}

/** The body of the last PUT /api/onboarding/state call. */
function lastPersistedData() {
  const calls = apiRequest.mock.calls.filter(
    ([url, opts]) => url === "/api/onboarding/state" && opts?.method === "PUT"
  )
  return JSON.parse(calls[calls.length - 1][1].body).data
}

beforeEach(() => {
  push.mockClear()
  replace.mockClear()
  apiRequest.mockReset()
  localStorage.clear()
})

describe("onboarding wizard", () => {
  // ── Skip removal ───────────────────────────────────────────────────────

  it("offers no Skip for now on a step that used to have one", async () => {
    // sales_tool was in the old SKIP_STEPS list. Skipping it silently
    // answered "GHL" on the user's behalf.
    bootAt(7)
    await screen.findByText(/what do you use for sales/i)
    expect(screen.queryByRole("button", { name: /skip for now/i })).toBeNull()
  })

  it("offers no Skip for now on the Slack step either", async () => {
    bootAt(13)
    await screen.findByText(/connect birdy to your slack/i)
    expect(screen.queryByRole("button", { name: /skip for now/i })).toBeNull()
  })

  // ── Slack opt-out replaces the generic skip ────────────────────────────

  it("lets a user with no Slack workspace past the Slack step", async () => {
    const user = userEvent.setup()
    bootAt(13)
    await screen.findByText(/connect birdy to your slack/i)

    await user.click(screen.getByRole("button", { name: /i don't use slack/i }))

    // Answering "no Slack" drops the three configuration steps, so the very
    // next step is the sub-accounts review — not the channel picker.
    await screen.findByText(/reviewing your ghl account|what we found in your ghl account/i)
    expect(screen.queryByText(/where should birdy briefs go/i)).toBeNull()
    expect(lastPersistedData()).toMatchObject({ slack_opt_out: true })
  })

  it("brings the Slack steps back if an opted-out user connects after all", async () => {
    const user = userEvent.setup()
    // Opted out earlier, went back, and has now connected a workspace. The
    // channel step has to reappear — otherwise they finish with a Slack
    // install Birdy was never told where to post in.
    bootAt(13, {
      data: { slack_opt_out: true },
      overrides: { "/api/integrations/slack/status": () => json({ installed: true }) },
    })
    await screen.findByText(/slack connected/i)

    await user.click(screen.getByRole("button", { name: /continue/i }))

    await screen.findByText(/where should birdy briefs go/i)
    expect(lastPersistedData()).toMatchObject({ slack_opt_out: false })
  })

  it("does not offer the Slack opt-out to someone already connected", async () => {
    bootAt(13, {
      overrides: {
        "/api/integrations/slack/status": () => json({ installed: true }),
      },
    })
    await screen.findByText(/connect birdy to your slack/i)
    await screen.findByText(/slack connected/i)
    expect(screen.queryByRole("button", { name: /i don't use slack/i })).toBeNull()
  })

  // ── "I don't currently call my leads" ──────────────────────────────────

  it("offers a third sales answer for agencies that don't call leads", async () => {
    const user = userEvent.setup()
    bootAt(7)
    await screen.findByText(/what do you use for sales/i)

    await user.click(screen.getByText(/i don't call my leads/i))

    // Persisted as a real answer, not as an absence — the Sales Hub reads it
    // to show "not available" rather than a confident 0.
    expect(lastPersistedData()).toMatchObject({ sales_tool: "none" })
  })

  // ── Currency moved out of sign-up and into the wizard ──────────────────

  it("asks for the client's currency after the client name", async () => {
    const user = userEvent.setup()
    bootAt(8, { data: PICKED_CLIENT })
    await screen.findByText(/want to change the client name/i)

    await user.click(screen.getByRole("button", { name: /confirm/i }))

    await screen.findByText(/what currency does .* report in/i)
  })

  it("persists the chosen currency and seeds it for the rest of the app", async () => {
    const user = userEvent.setup()
    bootAt(9, { data: PICKED_CLIENT })
    await screen.findByText(/what currency does .* report in/i)

    await user.selectOptions(screen.getByRole("combobox"), "USD")
    await user.click(screen.getByRole("button", { name: /continue/i }))

    expect(lastPersistedData()).toMatchObject({ currency: "USD" })
    // useCurrency reads this synchronously on first render, so it has to be
    // written here or the app renders £ for a user who just said dollars.
    expect(localStorage.getItem("user_default_currency")).toBe("USD")
  })

  it("labels the KPI targets in the currency the user chose", async () => {
    bootAt(11, { data: { ...PICKED_CLIENT, currency: "USD" } })
    await screen.findByText(/let's set some targets/i)

    expect(screen.getByText(/most agencies in your niche target \$30–60/i)).toBeTruthy()
    expect(screen.queryByText(/£30–60/)).toBeNull()
  })

  // ── First client creation no longer blocks the wizard ──────────────────

  it("carries on while the first client is still being created", async () => {
    const user = userEvent.setup()
    // The creation request blocks server-side on a full GHL history fetch.
    // Never resolving it is the honest worst case.
    bootAt(9, {
      data: PICKED_CLIENT,
      overrides: { "/api/client-groups": never },
    })
    await screen.findByText(/what currency does .* report in/i)

    await user.click(screen.getByRole("button", { name: /continue/i }))

    // Advanced to the next step even though creation is still in flight...
    await screen.findByText(/you connected your first client/i)
    // ...and says so, rather than pretending nothing is happening.
    expect(screen.getByText(/adding lizzie jayne's beauty/i)).toBeTruthy()
  })

  it("surfaces a creation failure as a retry instead of losing it", async () => {
    const user = userEvent.setup()
    bootAt(9, {
      data: PICKED_CLIENT,
      overrides: {
        "/api/client-groups": () =>
          Promise.resolve({ ok: false, status: 500, json: async () => ({ detail: "GHL is down" }) }),
      },
    })
    await screen.findByText(/what currency does .* report in/i)
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await screen.findByText(/couldn't add lizzie jayne's beauty/i)
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy()
  })

  // ── Finishing lands on the client they just set up ─────────────────────

  it("opens the first client, not the hub", async () => {
    const user = userEvent.setup()
    // The whole wizard exists to produce this one client. The hub is a list
    // they have no reason to read yet.
    bootAt(19, { data: { ...PICKED_CLIENT, first_client: {
      ...PICKED_CLIENT.first_client, group_id: "grp_1",
    } } })
    await screen.findByText(/you're all set/i)

    await user.click(screen.getByRole("button", { name: /take a look at birdy/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/clients/grp_1"))
  })

  it("recovers the client id from the server when the tab lost it", async () => {
    const user = userEvent.setup()
    // The id is set when background creation resolves, but an OAuth hop, a
    // Whop checkout redirect or a refresh all wipe React state in between.
    // First read (boot) has no group_id; the second (on finish) does.
    let statusCalls = 0
    bootAt(19, {
      data: PICKED_CLIENT,
      overrides: {
        "/api/onboarding/status": () => {
          statusCalls += 1
          return json({
            completed: false,
            step: 19,
            data: statusCalls === 1
              ? PICKED_CLIENT
              : { ...PICKED_CLIENT, first_client: { ...PICKED_CLIENT.first_client, group_id: "grp_recovered" } },
          })
        },
      },
    })
    await screen.findByText(/you're all set/i)

    await user.click(screen.getByRole("button", { name: /take a look at birdy/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/clients/grp_recovered"))
  })

  it("falls back to matching the GHL location when no id was ever stored", async () => {
    const user = userEvent.setup()
    bootAt(19, {
      data: PICKED_CLIENT,
      overrides: {
        "/api/client-groups?date_preset=today&include_daily=false": () =>
          json({ client_groups: [
            { id: "grp_other", ghl_location_id: "loc_999" },
            { id: "grp_matched", ghl_location_id: "loc_1" },
          ] }),
      },
    })
    await screen.findByText(/you're all set/i)

    await user.click(screen.getByRole("button", { name: /take a look at birdy/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/clients/grp_matched"))
  })

  it("still lets them in when there is no client to open", async () => {
    const user = userEvent.setup()
    // Creation failed and they chose to continue without it — the hub is the
    // honest destination, and being stuck in the wizard helps nobody.
    bootAt(19, { data: {} })
    await screen.findByText(/you're all set/i)

    await user.click(screen.getByRole("button", { name: /take a look at birdy/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/clients"))
  })

  // ── Connect buttons aren't live before we know they're needed ──────────

  it("does not offer Connect GHL while the status probe is still in flight", async () => {
    bootAt(3, { overrides: { "/api/status": never } })

    await screen.findByText(/let's get you connected to ghl/i)
    expect(screen.getByText(/checking connection/i)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /connect ghl/i })).toBeNull()
  })

  it("offers Connect GHL once the probe says they are not connected", async () => {
    bootAt(3, {
      overrides: {
        "/api/status": () => json({ gohighlevel: { agency: { connected: false } }, facebook: {} }),
      },
    })
    await screen.findByText(/let's get you connected to ghl/i)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /connect ghl/i })).toBeTruthy()
    )
  })

  it("falls back to the Connect button when the probe itself fails", async () => {
    // A probe that errors used to leave the step stuck on its initial state.
    // "Checking connection…" forever would be a worse bug than the one the
    // checking state fixes.
    bootAt(3, { overrides: { "/api/status": () => Promise.reject(new Error("offline")) } })
    await screen.findByText(/let's get you connected to ghl/i)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /connect ghl/i })).toBeTruthy()
    )
  })

  // ── KPI targets ────────────────────────────────────────────────────────

  // Index of `kpi_default` in visibleSteps for a non-HotProspector user who
  // has not opted out of Slack: STEPS minus hp_key.
  const KPI_DEFAULT_STEP = 12
  const CLIENT_CURRENCY_STEP = 9

  const WITH_GROUP = {
    ...PICKED_CLIENT,
    first_client: { ...PICKED_CLIENT.first_client, group_id: "g1" },
  }

  /** The body of the last PUT to a client group's targets endpoint. */
  function lastTargetsBody() {
    const calls = apiRequest.mock.calls.filter(
      ([url, opts]) => url === "/api/client-groups/g1/targets" && opts?.method === "PUT"
    )
    return calls.length ? JSON.parse(calls[calls.length - 1][1].body) : null
  }

  it("saves the targets under the names a client group actually stores", async () => {
    // The wizard was sending `cpa`, which is not a field on a client group, so
    // the whole PUT was rejected — taking monthly_wins, the one name that was
    // right, down with it. The client then reported no targets set at all.
    const user = userEvent.setup()
    bootAt(KPI_DEFAULT_STEP, {
      data: { ...WITH_GROUP, kpi: { cpa: "45", wins: "20", conv_rate: "15" } },
    })

    await screen.findByText(/save these as your defaults/i)
    await user.click(screen.getByRole("button", { name: /just this client/i }))

    await waitFor(() => expect(lastTargetsBody()).toEqual({
      cpl: 45,
      monthly_wins: 20,
      // Held as a fraction: what it is measured against is closes ÷ leads.
      conversion_rate: 0.15,
      save_as_default: false,
    }))
  })

  it("carries the save-as-default answer through to the request", async () => {
    const user = userEvent.setup()
    bootAt(KPI_DEFAULT_STEP, {
      data: { ...WITH_GROUP, kpi: { cpa: "45", wins: "20", conv_rate: "15" } },
    })

    await screen.findByText(/save these as your defaults/i)
    await user.click(screen.getByRole("button", { name: /set as default/i }))

    await waitFor(() => expect(lastTargetsBody()?.save_as_default).toBe(true))
  })

  it("leaves an unanswered target out rather than blanking it", async () => {
    // The endpoint merges, so an omitted field keeps what is stored.
    const user = userEvent.setup()
    bootAt(KPI_DEFAULT_STEP, {
      data: { ...WITH_GROUP, kpi: { cpa: "", wins: "20", conv_rate: "" } },
    })

    await screen.findByText(/save these as your defaults/i)
    await user.click(screen.getByRole("button", { name: /just this client/i }))

    await waitFor(() => expect(lastTargetsBody()).toEqual({
      monthly_wins: 20,
      save_as_default: false,
    }))
  })

  it("applies targets answered before the client group existed", async () => {
    // Answered while client creation was still running, then the page went
    // away — an OAuth hop, a refresh. The answers were persisted server-side
    // but the instruction to apply them lived in memory only, so nothing ever
    // put them on the group. Resuming on the currency step (which is what
    // kicks creation off) has to re-park them.
    const user = userEvent.setup()
    bootAt(CLIENT_CURRENCY_STEP, {
      data: {
        // No group_id: creation had not finished before the reload.
        ...PICKED_CLIENT,
        kpi: { cpa: "45", wins: "20", conv_rate: "15", save_default: true },
      },
      overrides: {
        "/api/client-groups": () => json({ client_group: { id: "g1" } }),
      },
    })

    await screen.findByText(/what currency does/i)
    await user.click(screen.getByRole("button", { name: /continue/i }))

    // Creation resolves with the id, and the parked targets go out against it.
    await waitFor(() => expect(lastTargetsBody()).toEqual({
      cpl: 45,
      monthly_wins: 20,
      conversion_rate: 0.15,
      save_as_default: true,
    }))
  })

  // ── Billing → import hand-over ─────────────────────────────────────────

  // Index of `billing` in visibleSteps for a non-HotProspector user who has
  // not opted out of Slack: STEPS minus hp_key.
  const BILLING_STEP = 18

  const PENDING_IMPORT = [
    { location_id: "loc_a", name: "Aura" },
    { location_id: "loc_b", name: "Blade & Blossom" },
    { location_id: "loc_c", name: "Clinic Six" },
  ]

  it("keeps counting the sub-accounts once the import has started", async () => {
    // The selection is held in a ref that is emptied the moment the import
    // fires, to stop a second one going out. The count on screen was reading
    // that same ref, so the render the import itself triggered found nothing
    // in it — and the progress line spent the entire import claiming to be
    // bringing in 0 sub-accounts.
    const user = userEvent.setup()
    bootAt(BILLING_STEP, {
      data: { ...PICKED_CLIENT, pending_import: PENDING_IMPORT },
      // Hold the import open, so the importing state is still on screen to
      // look at rather than having already moved on to the completion step.
      overrides: { "/api/onboarding/import-subaccounts": never },
    })

    await screen.findByText("billing step")
    expect(screen.getByTestId("account-count").textContent).toBe("3")

    await user.click(screen.getByRole("button", { name: "subscribe" }))

    await waitFor(() => expect(screen.getByTestId("importing").textContent).toBe("true"))
    expect(screen.getByTestId("account-count").textContent).toBe("3")
  })
})
