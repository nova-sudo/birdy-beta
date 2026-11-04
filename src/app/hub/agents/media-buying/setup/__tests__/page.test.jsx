import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig, useSWRConfig } from "swr"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))
const push = vi.fn()
let search = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import SetupPage from "../page"
import { modesPatches } from "@/components/agents/stock/ModesTable"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const BASE_SETTINGS = {
  batches: [
    { id: "a", name: "Batch A", weekdays: [0, 3] },
    { id: "b", name: "Batch B", weekdays: [1, 4] },
  ],
  weekly: { enabled: false, weekday: 0, auto_post: false },
  zones: { currency: "GBP", green_under: 8, red_over: 10 },
  treatments: [{ id: "skin", name: "Skin" }],
  clients: {},
  creative: { max_ads_live: 4, winner_days: 14, winner_min_leads: 8, revive_after_days: 60, major_downtrend_pct: 30, auto_max_adds: 2, data_window_days: 7 },
  modes: { remove: "ask", add: "ask", revive: "ask" },
  slack: {},
}

let agent
let groups
let slackStatus
let history
let previewRun
let report
let patchHandler
let activateHandler
let startHandler

const mkAgent = (over = {}) => ({
  id: "ag1",
  type: "stock_media_buying",
  name: "Birdy Media Buying Agent",
  status: "draft",
  scope: { client_group_ids: ["g1"], schedule: { time: "07:00", tz: "Europe/London" } },
  settings: BASE_SETTINGS,
  add_writes_enabled: false,
  ...over,
})

function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  if (path === "/api/agents" && method === "GET") return Promise.resolve(res([agent]))
  if (path === "/api/agents/ag1" && method === "GET") return Promise.resolve(res(agent))
  if (path === "/api/agents/ag1" && method === "PATCH") return Promise.resolve(res(agent))
  if (path === "/api/agents/ag1/settings" && method === "PATCH") return patchHandler(JSON.parse(init.body))
  if (path === "/api/agents/ag1/activate") return activateHandler(init.body ? JSON.parse(init.body) : {})
  if (path === "/api/agents/ag1/history") return Promise.resolve(res(history))
  if (path === "/api/agents/ag1/preview" && method === "POST") return startHandler()
  if (path === "/api/agents/ag1/runs/latest?kind=preview") return Promise.resolve(res({ run: previewRun, open_cards: 0 }))
  if (path === "/api/agents/ag1/runs/r1") return Promise.resolve(res(report))
  if (path.startsWith("/api/client-groups")) return Promise.resolve(res({ client_groups: groups }))
  if (path === "/api/integrations/slack/status") return Promise.resolve(res(slackStatus))
  if (path === "/api/integrations/slack/channels") return Promise.resolve(res({ channels: [{ id: "C1", name: "media" }] }))
  if (path.startsWith("/api/agents/ag1/work")) return Promise.resolve(res({ open: [], auto_applied: [] }))
  return Promise.resolve(res({}, 404))
}

const GROUPS = [
  { id: "g1", name: "Lumen Skin Clinic", meta_ad_account_id: "act_1", facebook: { currency: "GBP" } },
  { id: "g2", name: "Berlin Body Co", meta_ad_account_id: "act_2", facebook: { currency: "EUR" } },
  { id: "g3", name: "No Meta Ltd", meta_ad_account_id: null },
]

// A background refetch of everything on screen, as focus or a poll would trigger.
let refetchAll
function GrabMutate() {
  const { mutate } = useSWRConfig()
  refetchAll = () => mutate(() => true)
  return null
}

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <GrabMutate />
      <SetupPage />
    </SWRConfig>
  )

const calls = (path, method) => vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === path && (init?.method ?? "GET") === method)
const bodies = (path, method) => calls(path, method).map(([, init]) => JSON.parse(init.body))
const cont = () => screen.getByRole("button", { name: /Continue/ })

beforeEach(() => {
  agent = mkAgent()
  groups = GROUPS
  slackStatus = { installed: false }
  history = { total: 1, ready: 1, clients: [] }
  previewRun = null
  report = null
  search = ""
  patchHandler = () => Promise.resolve(res(agent))
  activateHandler = () => Promise.resolve(res({ ...agent, status: "active" }))
  startHandler = () => Promise.resolve(res({ run_id: "r1", kind: "preview", phase: "done", done: true }))
  push.mockReset()
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

describe("Stock agent guided setup: steps", () => {
  it("shows the step named by ?step= and falls back to the first", async () => {
    search = "step=4"
    const { unmount } = renderPage()
    expect(await screen.findByRole("heading", { name: "Slack" })).toBeInTheDocument()
    unmount()
    // A reload with the same address lands on the same step.
    renderPage()
    expect(await screen.findByRole("heading", { name: "Slack" })).toBeInTheDocument()
  })

  it("an unknown step is the first", async () => {
    search = "step=9"
    renderPage()
    expect(await screen.findByRole("heading", { name: "When should it check?" })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Setup steps" })).toHaveTextContent("Preview first report")
  })

  it("Continue saves the schedule and the batch days, then moves to step 2", async () => {
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Batch A Wed" }))
    await userEvent.click(cont())
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/media-buying/setup?step=2"))
    expect(bodies("/api/agents/ag1", "PATCH")[0]).toEqual({ scope: { schedule: { time: "07:00", tz: "Europe/London" } } })
    const sent = bodies("/api/agents/ag1/settings", "PATCH")[0].settings
    expect(sent.batches[0].weekdays).toEqual([0, 2, 3])
    expect(sent.weekly).toEqual({ enabled: false, weekday: 0 })
  })

  it("refuses a run time after 23:30, says why, and allows 23:30", async () => {
    renderPage()
    const time = await screen.findByLabelText("Every day at")
    fireEvent.change(time, { target: { value: "23:50" } })
    expect(await screen.findByRole("alert")).toHaveTextContent(/23:30/)
    expect(cont()).toBeDisabled()
    fireEvent.change(time, { target: { value: "23:30" } })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(cont()).toBeEnabled()
  })
})

describe("Stock agent guided setup: clients and targets", () => {
  beforeEach(() => {
    search = "step=2"
    agent = mkAgent({
      scope: { client_group_ids: ["g1", "g2"], schedule: { time: "07:00", tz: "Europe/London" } },
      settings: { ...BASE_SETTINGS, clients: { g1: { batch_id: "a" }, g2: { batch_id: "b" } } },
    })
  })

  it("asks a client in another currency for its own zones on its row and blocks Continue", async () => {
    renderPage()
    const row = (await screen.findByText("Berlin Body Co")).closest("tr")
    expect(within(row).getByRole("alert")).toHaveTextContent(/account is in EUR, which the default zones \(GBP\) don't cover/)
    expect(cont()).toBeDisabled()
    await userEvent.type(within(row).getByLabelText("Green under for Berlin Body Co"), "9")
    await userEvent.type(within(row).getByLabelText("Red over for Berlin Body Co"), "12")
    expect(within(row).queryByRole("alert")).not.toBeInTheDocument()
    expect(cont()).toBeEnabled()
  })

  it("blocks Continue when red is below green, for the default and for a client", async () => {
    renderPage()
    await screen.findByText("Berlin Body Co")
    const red = screen.getByLabelText("Red over", { selector: "#stock-zone-red" })
    await userEvent.clear(red)
    await userEvent.type(red, "5")
    expect(screen.getAllByRole("alert").some((a) => /Red must be at least the green limit/.test(a.textContent))).toBe(true)
    expect(cont()).toBeDisabled()
  })

  it("shows the needs-a-red-limit error on a row whose green limit came from its CPL target", async () => {
    groups = [{ ...GROUPS[0], targets: { cpl: 7 } }, GROUPS[1], GROUPS[2]]
    renderPage()
    const row = (await screen.findByText("Lumen Skin Clinic")).closest("tr")
    expect(within(row).getByLabelText("Green under for Lumen Skin Clinic")).toHaveValue("7")
    expect(within(row).getByRole("alert")).toHaveTextContent(/only one zone limit set; it needs a red limit too/)
    expect(cont()).toBeDisabled()
  })

  it("blocks Continue when one client's red is below its green, on that row", async () => {
    renderPage()
    const row = (await screen.findByText("Berlin Body Co")).closest("tr")
    await userEvent.type(within(row).getByLabelText("Green under for Berlin Body Co"), "12")
    await userEvent.type(within(row).getByLabelText("Red over for Berlin Body Co"), "9")
    expect(within(row).getByRole("alert")).toHaveTextContent(/red must be at least the green limit/)
    expect(cont()).toBeDisabled()
  })

  it("blocks Continue on a typed green limit with no red, and clears when red is typed", async () => {
    renderPage()
    const row = (await screen.findByText("Berlin Body Co")).closest("tr")
    await userEvent.type(within(row).getByLabelText("Green under for Berlin Body Co"), "9")
    expect(within(row).getByRole("alert")).toHaveTextContent(/only one zone limit set; it needs a red limit too/)
    expect(cont()).toBeDisabled()
    await userEvent.type(within(row).getByLabelText("Red over for Berlin Body Co"), "12")
    expect(cont()).toBeEnabled()
  })

  it("a cleared green limit stays cleared, even after unticking and ticking the client", async () => {
    groups = [{ ...GROUPS[0], targets: { cpl: 7 } }, GROUPS[1], GROUPS[2]]
    renderPage()
    const row = (await screen.findByText("Lumen Skin Clinic")).closest("tr")
    await userEvent.clear(within(row).getByLabelText("Green under for Lumen Skin Clinic"))
    expect(within(row).queryByRole("alert")).not.toBeInTheDocument()
    await userEvent.click(within(row).getByRole("checkbox"))
    await userEvent.click(within(row).getByRole("checkbox"))
    expect(within(row).getByLabelText("Green under for Lumen Skin Clinic")).toHaveValue("")
  })

  it("does not refill a green limit that was saved as empty", async () => {
    groups = [{ ...GROUPS[0], targets: { cpl: 7 } }, GROUPS[1], GROUPS[2]]
    agent = mkAgent({ settings: { ...BASE_SETTINGS, clients: { g1: { batch_id: "a", zones: { green_under: null, red_over: null } } } } })
    renderPage()
    const row = (await screen.findByText("Lumen Skin Clinic")).closest("tr")
    expect(within(row).getByLabelText("Green under for Lumen Skin Clinic")).toHaveValue("")
  })

  it("gives a client that arrives later a row, and ticking it does not throw", async () => {
    let creating = true
    vi.mocked(apiRequest).mockImplementation((path, init = {}) =>
      path.startsWith("/api/client-groups")
        ? Promise.resolve(res({ client_groups: creating ? GROUPS.slice(0, 1) : GROUPS }))
        : mockApi(path, init)
    )
    renderPage()
    await screen.findByText("Lumen Skin Clinic")
    creating = false
    await act(async () => { await refetchAll() })
    const row = (await screen.findByText("Berlin Body Co")).closest("tr")
    await userEvent.click(within(row).getByRole("checkbox"))
    expect(within(row).getByLabelText("Green under for Berlin Body Co")).toBeInTheDocument()
  })

  it("lets a client that was deleted be dropped: it is not sent back", async () => {
    agent = mkAgent({ scope: { client_group_ids: ["g1", "gone"], schedule: { time: "07:00", tz: "Europe/London" } } })
    renderPage()
    await screen.findByText("Lumen Skin Clinic")
    await userEvent.click(cont())
    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(bodies("/api/agents/ag1/settings", "PATCH")[0].client_group_ids).toEqual(["g1"])
  })

  it("a background refetch while someone is typing does not overwrite their input", async () => {
    renderPage()
    const row = (await screen.findByText("Berlin Body Co")).closest("tr")
    const green = within(row).getByLabelText("Green under for Berlin Body Co")
    await userEvent.type(green, "9")
    const defaultGreen = screen.getByLabelText("Green under", { selector: "#stock-zone-green" })
    await userEvent.clear(defaultGreen)
    await userEvent.type(defaultGreen, "6")
    const before = calls("/api/agents/ag1", "GET").length
    agent = mkAgent({ scope: agent.scope, settings: { ...agent.settings, zones: { currency: "GBP", green_under: 3, red_over: 4 } } })
    await act(async () => { await refetchAll() })
    expect(calls("/api/agents/ag1", "GET").length).toBeGreaterThan(before)
    expect(screen.getByLabelText("Green under for Berlin Body Co")).toHaveValue("9")
    expect(screen.getByLabelText("Green under", { selector: "#stock-zone-green" })).toHaveValue("6")
  })

  it("shows a client with no Meta account disabled, with the reason", async () => {
    renderPage()
    const row = (await screen.findByText("No Meta Ltd")).closest("tr")
    expect(within(row).getByRole("checkbox")).toBeDisabled()
    expect(row).toHaveTextContent("No Meta ad account is connected")
  })

  it("saves zones, clients, only_flag and the client list together", async () => {
    renderPage()
    const row = (await screen.findByText("Berlin Body Co")).closest("tr")
    await userEvent.type(within(row).getByLabelText("Green under for Berlin Body Co"), "9")
    await userEvent.type(within(row).getByLabelText("Red over for Berlin Body Co"), "12")
    await userEvent.click(cont())
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/media-buying/setup?step=3"))
    const body = bodies("/api/agents/ag1/settings", "PATCH")[0]
    expect(body.client_group_ids).toEqual(["g1", "g2"])
    expect(body.only_flag).toEqual([])
    expect(body.settings.zones).toEqual({ currency: "GBP", green_under: 8, red_over: 10 })
    expect(body.settings.clients.g2.zones).toEqual({ green_under: 9, red_over: 12 })
    expect(body.settings.clients.g1.zones).toEqual({ green_under: null, red_over: null })
  })

  describe("a client another agent holds", () => {
    const CONFLICT = {
      detail: "Another agent already acts on Old rules",
      conflicts: [{ client_group_id: "g1", holder_id: "ag7", holder_name: "Old rules" }],
    }
    const fillG2 = async () => {
      const row = (await screen.findByText("Berlin Body Co")).closest("tr")
      await userEvent.type(within(row).getByLabelText("Green under for Berlin Body Co"), "9")
      await userEvent.type(within(row).getByLabelText("Red over for Berlin Body Co"), "12")
    }

    it("offers Move it here and Only flag; Only flag resends with only_flag and the client list", async () => {
      let first = true
      patchHandler = () => {
        if (first) {
          first = false
          return Promise.resolve(res(CONFLICT, 409))
        }
        return Promise.resolve(res(agent))
      }
      agent = mkAgent({ scope: { client_group_ids: ["g1"], schedule: { time: "07:00", tz: "Europe/London" } } })
      renderPage()
      await screen.findByText("Lumen Skin Clinic")
      await userEvent.click(cont())
      expect(await screen.findByText(/is with Old rules/)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Move it here" })).toBeInTheDocument()
      await userEvent.click(screen.getByRole("button", { name: "Only flag" }))
      await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/media-buying/setup?step=3"))
      const second = bodies("/api/agents/ag1/settings", "PATCH")[1]
      expect(second.only_flag).toEqual(["g1"])
      expect(second.client_group_ids).toEqual(["g1"])
      expect(second.move_claims).toBeUndefined()
    })

    it("Move all after Only flag on one client keeps that client flagged and never moves it", async () => {
      const two = {
        detail: "x",
        conflicts: [
          { client_group_id: "g1", holder_id: "ag7", holder_name: "Old rules" },
          { client_group_id: "g2", holder_id: "ag7", holder_name: "Old rules" },
        ],
      }
      let n = 0
      patchHandler = () => (++n <= 2 ? Promise.resolve(res(two, 409)) : Promise.resolve(res(agent)))
      renderPage()
      await fillG2()
      await userEvent.click(cont())
      await screen.findByRole("button", { name: "Move all here" })
      await userEvent.click(screen.getAllByRole("button", { name: "Only flag" })[0])
      await screen.findByRole("button", { name: "Move all here" })
      await userEvent.click(screen.getByRole("button", { name: "Move all here" }))
      await waitFor(() => expect(push).toHaveBeenCalled())
      const sent = bodies("/api/agents/ag1/settings", "PATCH")
      expect(sent[2].move_claims).toBe(true)
      expect(sent[2].only_flag).toEqual(["g1"])
    })
  })

  it("shows a 400's field errors on the matching row", async () => {
    agent = mkAgent({ settings: { ...BASE_SETTINGS, clients: { g1: { batch_id: "a" } } } })
    patchHandler = () =>
      Promise.resolve(res({ detail: "Some settings are invalid", errors: [{ field: "clients.zones", client_group_id: "g1", message: "must be a number, 0 or more" }] }, 400))
    renderPage()
    const row = (await screen.findByText("Lumen Skin Clinic")).closest("tr")
    await userEvent.click(cont())
    expect(await within(row).findByRole("alert")).toHaveTextContent("must be a number, 0 or more")
    expect(push).not.toHaveBeenCalled()
  })
})

describe("Stock agent guided setup: Slack", () => {
  beforeEach(() => {
    search = "step=4"
  })

  it("not connected is a Notice and Continue still works, saving nothing", async () => {
    renderPage()
    expect(await screen.findByText("Slack isn't connected")).toBeInTheDocument()
    await userEvent.click(cont())
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/media-buying/setup?step=5"))
    expect(calls("/api/agents/ag1/settings", "PATCH")).toHaveLength(0)
  })

  it("connected shows the channel picker with the approval note", async () => {
    slackStatus = { installed: true }
    renderPage()
    expect(await screen.findByText(/Anyone in this channel can approve a card/)).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })
})

describe("Stock agent guided setup: Slack channel problems", () => {
  beforeEach(() => {
    search = "step=4"
    slackStatus = { installed: true }
  })

  it("a channel list the token can't read gives a Reconnect Slack link", async () => {
    vi.mocked(apiRequest).mockImplementation((path, init = {}) =>
      path === "/api/integrations/slack/channels"
        ? Promise.resolve(res({ detail: "Birdy can't read your channel list yet. Reconnect Slack to grant channel access." }, 409))
        : mockApi(path, init)
    )
    renderPage()
    const link = await screen.findByRole("link", { name: "Reconnect Slack" })
    expect(link).toHaveAttribute("href", "/settings?tab=integrations")
  })

  it("a chosen channel can be cleared", async () => {
    agent = mkAgent({ settings: { ...BASE_SETTINGS, slack: { channel_id: "C1", channel_name: "media" } } })
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Clear channel" }))
    await userEvent.click(cont())
    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(bodies("/api/agents/ag1/settings", "PATCH")[0].settings.slack).toEqual({ channel_id: null, channel_name: null })
  })
})

describe("Stock agent guided setup: modes", () => {
  beforeEach(() => {
    search = "step=5"
  })

  const addGroup = async () => (await screen.findByText("Add", { selector: "div" })).closest("div.flex")

  it("Add shows Flag only while the server has adding switched off", async () => {
    agent = mkAgent({ add_writes_enabled: false })
    renderPage()
    const add = await addGroup()
    expect(within(add).getByRole("tab", { name: "Flag" })).toHaveAttribute("aria-selected", "true")
    expect(within(add).getByRole("tab", { name: "Ask me" })).toBeDisabled()
    expect(within(add).getByRole("tab", { name: "Auto" })).toBeDisabled()
    expect(screen.getByText(/Posting new ads is switched off/)).toBeInTheDocument()
  })

  it("Add can be Ask me or Auto when the agent view says adding is on, and Auto warns", async () => {
    agent = mkAgent({ add_writes_enabled: true })
    renderPage()
    const add = await addGroup()
    expect(within(add).getByRole("tab", { name: "Ask me" })).toBeEnabled()
    expect(within(add).getByRole("tab", { name: "Auto" })).toBeEnabled()
    expect(within(add).getByRole("tab", { name: "Ask me" })).toHaveAttribute("aria-selected", "true")
    await userEvent.click(within(add).getByRole("tab", { name: "Auto" }))
    expect(await screen.findByText("Auto changes live Meta ads")).toBeInTheDocument()
    await userEvent.click(cont())
    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(bodies("/api/agents/ag1/settings", "PATCH")[0].settings.modes.add).toBe("auto")
  })

  it("an add_writes_enabled left inside settings is not used", async () => {
    agent = mkAgent({ add_writes_enabled: false, settings: { ...BASE_SETTINGS, add_writes_enabled: true } })
    renderPage()
    expect(within(await addGroup()).getByRole("tab", { name: "Auto" })).toBeDisabled()
  })
})

describe("Stock agent guided setup: saving modes", () => {
  beforeEach(() => {
    search = "step=5"
  })

  it("Continue saves the chosen modes and moves to the preview", async () => {
    renderPage()
    await screen.findByText("For every client")
    await userEvent.click(screen.getAllByRole("tab", { name: "Auto" })[0])
    await userEvent.click(cont())
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/media-buying/setup?step=6"))
    expect(bodies("/api/agents/ag1/settings", "PATCH")[0].settings.modes).toEqual({ remove: "auto", add: "ask", revive: "ask" })
  })

  it("clearing a client's override sends modes: null before the rest, because the server merges objects", () => {
    const before = { modes: { remove: "ask", add: "ask", revive: "ask" }, clientModes: { g1: { remove: "auto", revive: "flag" } } }
    const next = { modes: before.modes, clientModes: { g1: { revive: "flag" } } }
    expect(modesPatches(before, next)).toEqual([
      { clients: { g1: { modes: null } } },
      { modes: before.modes, clients: { g1: { modes: { revive: "flag" } } } },
    ])
  })
})

describe("Stock agent guided setup: preview and turn on", () => {
  beforeEach(() => {
    search = "step=6"
  })

  it("shows history progress, holds the preview, and keeps Turn on disabled", async () => {
    history = { total: 2, ready: 1, clients: [] }
    renderPage()
    expect(await screen.findByText(/1 of 2 clients ready/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Run the preview/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Turn on/ })).toBeDisabled()
  })

  it("runs the preview, shows the report, and only then enables Turn on", async () => {
    renderPage()
    const turnOn = await screen.findByRole("button", { name: /Turn on/ })
    expect(turnOn).toBeDisabled()
    previewRun = { id: "r1", kind: "preview", phase: "done", clients: { g1: { state: "done" } } }
    report = {
      run: previewRun,
      cards: [
        { id: "c1", client_name: "Lumen Skin Clinic", tag: "changes", currency: "GBP", previous_cpl: 9, current_cpl: 11.5, thought_process: "Cost rose.", lines: [{ id: "l1", kind: "remove", ad_name: "Static 4", mode: "ask" }] },
      ],
    }
    await userEvent.click(screen.getByRole("button", { name: /Run the preview/ }))
    // The real report component, collapsed and with nothing to press: a preview writes nothing.
    const row = await screen.findByRole("article", { name: "Lumen Skin Clinic" })
    await userEvent.click(within(row).getByRole("button", { name: /Lumen Skin Clinic/ }))
    expect(row).toHaveTextContent("Remove - Static 4")
    for (const name of ["Apply", "Edit", "Dismiss"]) expect(within(row).queryByRole("button", { name })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Apply \d/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Report date" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Turn on/ })).toBeEnabled()
    expect(calls("/api/agents/ag1/preview", "POST")).toHaveLength(1)
  })

  it("a preview that missed a watched client is not finished", async () => {
    previewRun = { id: "r1", kind: "preview", phase: "done", clients: { gX: { state: "done" } } }
    renderPage()
    expect(await screen.findByText(/didn't finish or didn't cover every client/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Turn on/ })).toBeDisabled()
  })

  it("lists a preview 409's clients that aren't ready", async () => {
    startHandler = () => Promise.resolve(res({ detail: "Ad history isn't ready yet", not_ready: ["g1"] }, 409))
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: /Run the preview/ }))
    expect(await screen.findByText(/Ad history isn't ready yet for Lumen Skin Clinic/)).toBeInTheDocument()
  })

  const finishedPreview = () => {
    previewRun = { id: "r1", kind: "preview", phase: "done", clients: { g1: { state: "done" } } }
    report = { run: previewRun, cards: [] }
  }

  it("lists what a 409 says is missing", async () => {
    finishedPreview()
    activateHandler = () => Promise.resolve(res({ detail: "The agent isn't ready to switch on yet", missing: ["Choose at least one client to watch", "Preview the first report"], errors: [] }, 409))
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: /Turn on/ }))
    expect(await screen.findByText("Choose at least one client to watch")).toBeInTheDocument()
    expect(screen.getByText("Preview the first report")).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it("turns on and opens the agent page", async () => {
    finishedPreview()
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: /Turn on/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/media-buying"))
    expect(bodies("/api/agents/ag1/activate", "POST")[0]).toEqual({ only_flag: [] })
  })

  it("a preview that stopped early says so and offers a retry, with Turn on disabled", async () => {
    previewRun = { id: "r1", kind: "preview", phase: "done", ended_early: true, clients: { g1: { state: "done" } } }
    renderPage()
    expect(await screen.findByText(/stopped before it finished/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Run the preview again/ })).toBeEnabled()
    expect(screen.getByRole("button", { name: /Turn on/ })).toBeDisabled()
  })

  it("a preview where every client failed is not finished and shows the reason", async () => {
    previewRun = { id: "r1", kind: "preview", phase: "done", clients: { g1: { state: "failed", error: "Meta needs reconnecting. Reconnect to check this client." } } }
    renderPage()
    expect(await screen.findByText(/couldn't check any client/)).toBeInTheDocument()
    expect(screen.getByText(/Meta needs reconnecting/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Turn on/ })).toBeDisabled()
  })

  it("reloading mid-preview shows it running, with the button held, then finishes by itself", async () => {
    previewRun = { id: "r1", kind: "preview", phase: "checks", clients: { g1: { state: "pending" } } }
    renderPage()
    expect(await screen.findByText(/This can take a few minutes/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Run the preview/ })).toBeDisabled()
    previewRun = { id: "r1", kind: "preview", phase: "done", clients: { g1: { state: "done" } } }
    report = { run: previewRun, cards: [] }
    await act(async () => { await refetchAll() })
    expect(await screen.findByText("Your first report")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Turn on/ })).toBeEnabled()
  })

  it("a preview waiting on data says it is waiting, not that it takes a few minutes", async () => {
    previewRun = { id: "r1", kind: "preview", phase: "checks", clients: { g1: { state: "waiting" } } }
    renderPage()
    expect(await screen.findByText(/waiting for ad data/i)).toBeInTheDocument()
    expect(screen.queryByText(/few minutes/)).not.toBeInTheDocument()
  })

  it("shows the few-minutes status while the start request is out, and a double click starts once", async () => {
    let release
    startHandler = () => new Promise((r) => { release = () => r(res({ run_id: "r1", kind: "preview", phase: "checks", done: false })) })
    renderPage()
    const run = await screen.findByRole("button", { name: /Run the preview/ })
    await userEvent.dblClick(run)
    expect(await screen.findByText(/This can take a few minutes/)).toBeInTheDocument()
    expect(calls("/api/agents/ag1/preview", "POST")).toHaveLength(1)
    release()
  })

  describe("turning on when another agent holds clients (the real path: a 409 on activate)", () => {
    const two = () => {
      agent = mkAgent({ scope: { client_group_ids: ["g1", "g2"], schedule: { time: "07:00", tz: "Europe/London" } } })
      previewRun = { id: "r1", kind: "preview", phase: "done", clients: { g1: { state: "done" }, g2: { state: "done" } } }
      report = { run: previewRun, cards: [] }
    }
    const CONFLICT = {
      detail: "Another agent already acts on Old rules",
      conflicts: [
        { client_group_id: "g1", holder_id: "ag7", holder_name: "Old rules" },
        { client_group_id: "g2", holder_id: "ag7", holder_name: "Old rules" },
      ],
    }

    it("Only flag on one client, then Move all, never moves the flagged one", async () => {
      two()
      let n = 0
      activateHandler = () => (++n <= 2 ? Promise.resolve(res(CONFLICT, 409)) : Promise.resolve(res({ ...agent, status: "active" })))
      renderPage()
      await userEvent.click(await screen.findByRole("button", { name: /Turn on/ }))
      await screen.findByRole("button", { name: "Move all here" })
      await userEvent.click(screen.getAllByRole("button", { name: "Only flag" })[0])
      await screen.findByRole("button", { name: "Move all here" })
      await userEvent.click(screen.getByRole("button", { name: "Move all here" }))
      await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/media-buying"))
      const sent = bodies("/api/agents/ag1/activate", "POST")
      expect(sent[1]).toEqual({ only_flag: ["g1"] })
      expect(sent[2]).toEqual({ only_flag: ["g1"], move_claims: true })
    })
  })
})
