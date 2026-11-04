import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }), useSearchParams: () => new URLSearchParams("") }))

import { ConfirmHost } from "@/components/ds"
import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { useStockActions } from "@/lib/stock-agent-api"
import { AgentSettings } from "../AgentSettings"
import { LessonsList } from "../LessonsList"

// Radix Select asks jsdom for these.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const SETTINGS = {
  batches: [
    { id: "a", name: "Batch A", weekdays: [0, 3] },
    { id: "b", name: "Batch B", weekdays: [1, 4] },
  ],
  weekly: { enabled: false, weekday: 0, auto_post: false },
  zones: { currency: "GBP", green_under: 8, red_over: 10 },
  treatments: [],
  clients: {},
  creative: { max_ads_live: 4, winner_days: 14, winner_min_leads: 8, revive_after_days: 60, major_downtrend_pct: 30, auto_max_adds: 2, data_window_days: 7 },
  modes: { remove: "ask", add: "ask", revive: "ask" },
  slack: { channel_id: "C1", channel_name: "media" },
}
const mkAgent = (over = {}) => ({
  id: "ag1",
  type: "stock_media_buying",
  name: "Birdy Media Buying Agent",
  status: "active",
  scope: { client_group_ids: ["g1", "g2"], schedule: { time: "07:00", tz: "Europe/London" } },
  settings: SETTINGS,
  add_writes_enabled: true,
  ...over,
})
const CLIENTS = [
  { id: "g1", name: "Lumen Skin Clinic", account: "act_1", currency: "GBP", cpl: null },
  { id: "g2", name: "Velvet Laser", account: "act_2", currency: "GBP", cpl: null },
]

const DEFAULT_CARD = [{ type: "header", text: { type: "plain_text", text: "{{client}}" } }]
const view = (kind, over = {}) => ({
  kind,
  customised: false,
  template: { blocks: DEFAULT_CARD },
  defaults: { blocks: DEFAULT_CARD },
  placeholders: ["client", "window", "zone"],
  notice: null,
  ...over,
})

let agent
let lessons
let views
let patchHandler
let previewHandler
let activateHandler

function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  const body = init.body ? JSON.parse(init.body) : undefined
  if (path === "/api/agents/ag1" && method === "GET") return Promise.resolve(res(agent))
  if (path === "/api/agents/ag1" && method === "PATCH") return Promise.resolve(res(agent))
  if (path === "/api/agents") return Promise.resolve(res([agent]))
  if (path === "/api/agents/ag1/settings" && method === "PATCH") return patchHandler(body)
  if (path === "/api/agents/ag1/deactivate" && method === "POST") return Promise.resolve(res({ ...agent, status: "draft", turned_off_at: "2026-11-04T09:00:00" }))
  if (path === "/api/agents/ag1/activate" && method === "POST") return activateHandler(body)
  if (path === "/api/integrations/slack/status") return Promise.resolve(res({ installed: true }))
  if (path === "/api/integrations/slack/channels") return Promise.resolve(res({ channels: [{ id: "C1", name: "media" }] }))
  if (path === "/api/agents/ag1/lessons" && method === "GET") return Promise.resolve(res(lessons))
  const lesson = /^\/api\/agents\/ag1\/lessons\/(\w+)\/(keep|overrule)$/.exec(path)
  if (lesson && method === "POST") {
    lessons = lessons.map((l) => (l.id === lesson[1] ? { ...l, status: lesson[2] === "overrule" ? "overruled" : "active" } : l))
    return Promise.resolve(res(lessons.find((l) => l.id === lesson[1])))
  }
  const tpl = /^\/api\/agents\/ag1\/slack-templates\/(card|summary|weekly)(\/preview)?$/.exec(path)
  if (tpl) {
    const kind = tpl[1]
    if (tpl[2]) return previewHandler(kind, body)
    if (method === "GET") return Promise.resolve(res(views[kind]))
    if (method === "PUT") {
      views[kind] = view(kind, { customised: true, template: { blocks: body.blocks }, notice: null })
      return Promise.resolve(res(views[kind]))
    }
    if (method === "DELETE") {
      views[kind] = view(kind)
      return Promise.resolve(res(views[kind]))
    }
  }
  return Promise.resolve(res({}, 404))
}

const calls = (path, method) => vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === path && (init?.method ?? "GET") === method)
const bodies = (path, method) => calls(path, method).map(([, init]) => JSON.parse(init.body))

function Host({ children }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <ConfirmHost />
      {children}
    </SWRConfig>
  )
}
function Settings() {
  const actions = useStockActions("ag1")
  return <AgentSettings agent={agent} clients={CLIENTS} actions={actions} />
}
function Lessons() {
  const actions = useStockActions("ag1")
  return <LessonsList agentId="ag1" actions={actions} nameOf={(gid) => CLIENTS.find((c) => c.id === gid)?.name ?? "A client"} />
}
const fireEventTime = (el, value) => fireEvent.change(el, { target: { value } })
const renderSettings = () => render(<Host><Settings /></Host>)
const section = (name) => screen.getByRole("region", { name })

beforeEach(() => {
  agent = mkAgent()
  lessons = []
  views = { card: view("card"), summary: view("summary", { placeholders: ["date", "batch"] }), weekly: view("weekly", { placeholders: ["week"] }) }
  patchHandler = () => Promise.resolve(res(agent))
  activateHandler = () => Promise.resolve(res({ ...agent, status: "active", turned_off_at: null }))
  previewHandler = () => Promise.resolve(res({ kind: "card", blocks: [{ type: "header", text: { type: "plain_text", text: "Glow Aesthetics" } }], sample: true }))
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

describe("Agent settings: modes", () => {
  it("a changed mode is saved", async () => {
    renderSettings()
    const modes = within(await screen.findByRole("region", { name: "Flag, Ask me or Auto settings" }))
    await userEvent.click(within(modes.getByRole("tablist", { name: "Remove mode" })).getByRole("tab", { name: "Auto" }))
    await userEvent.click(modes.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(bodies("/api/agents/ag1/settings", "PATCH")).toHaveLength(1))
    expect(bodies("/api/agents/ag1/settings", "PATCH")[0]).toEqual({ settings: { modes: { remove: "auto", add: "ask", revive: "ask" } } })
    expect(await modes.findByText("Saved.")).toBeInTheDocument()
  })

  it("Add can't leave Flag while the agent's top-level add_writes_enabled is off", async () => {
    agent = mkAgent({ add_writes_enabled: false, settings: { ...SETTINGS, add_writes_enabled: true } })
    renderSettings()
    const modes = within(await screen.findByRole("region", { name: "Flag, Ask me or Auto settings" }))
    expect(within(modes.getByRole("tablist", { name: "Add mode" })).getByRole("tab", { name: "Auto" })).toBeDisabled()
  })

  it("a client override is added, then removed with the two patches the server needs", async () => {
    const user = userEvent.setup()
    const { unmount } = renderSettings()
    let modes = within(await screen.findByRole("region", { name: "Flag, Ask me or Auto settings" }))
    await user.click(modes.getByRole("combobox", { name: "Remove for Velvet Laser" }))
    await user.click(await screen.findByRole("option", { name: "Flag" }))
    await user.click(modes.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(bodies("/api/agents/ag1/settings", "PATCH")).toHaveLength(1))
    expect(bodies("/api/agents/ag1/settings", "PATCH")[0].settings.clients).toEqual({ g2: { modes: { remove: "flag" } } })
    unmount()

    vi.mocked(apiRequest).mockClear()
    agent = mkAgent({ settings: { ...SETTINGS, clients: { g2: { modes: { remove: "flag" } } } } })
    renderSettings()
    modes = within(await screen.findByRole("region", { name: "Flag, Ask me or Auto settings" }))
    await user.click(modes.getByRole("combobox", { name: "Remove for Velvet Laser" }))
    await user.click(await screen.findByRole("option", { name: /^Default/ }))
    await user.click(modes.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(bodies("/api/agents/ag1/settings", "PATCH")).toHaveLength(2))
    expect(bodies("/api/agents/ag1/settings", "PATCH")[0]).toEqual({ settings: { clients: { g2: { modes: null } } } })
    expect(bodies("/api/agents/ag1/settings", "PATCH")[1].settings.modes).toEqual({ remove: "ask", add: "ask", revive: "ask" })
  })

  it("a refused patch is shown on the client's row", async () => {
    patchHandler = () =>
      Promise.resolve(res({ detail: "Some settings need fixing", errors: [{ client_group_id: "g2", message: "Velvet Laser can't be set to Auto" }] }, 400))
    agent = mkAgent({ settings: { ...SETTINGS, clients: { g2: { modes: { remove: "flag" } } } } })
    renderSettings()
    const modes = within(await screen.findByRole("region", { name: "Flag, Ask me or Auto settings" }))
    await userEvent.click(within(modes.getByRole("tablist", { name: "Revive mode" })).getByRole("tab", { name: "Flag" }))
    await userEvent.click(modes.getByRole("button", { name: "Save changes" }))
    const row = (await modes.findByText("Velvet Laser can't be set to Auto")).closest("tr")
    expect(within(row).getByText("Velvet Laser")).toBeInTheDocument()
  })
})

describe("Agent settings: the other forms", () => {
  it("a client claim error and a row error show on the clients table, and only_flag goes with the client list", async () => {
    const user = userEvent.setup()
    patchHandler = vi
      .fn()
      .mockResolvedValueOnce(res({ detail: "Another agent acts on this client", conflicts: [{ client_group_id: "g2", holder_name: "Pause and revive rules" }] }, 409))
      .mockResolvedValue(res(agent))
    renderSettings()
    const clients = within(await screen.findByRole("region", { name: "Clients and targets settings" }))
    await user.click(await clients.findByRole("button", { name: "Save changes" }))
    await user.click(await screen.findByRole("button", { name: "Only flag" }))
    await waitFor(() => expect(bodies("/api/agents/ag1/settings", "PATCH")).toHaveLength(2))
    const second = bodies("/api/agents/ag1/settings", "PATCH")[1]
    expect(second.client_group_ids).toEqual(["g1", "g2"])
    expect(second.only_flag).toEqual(["g2"])
  })

  it("a refused client patch shows its message on that client's row", async () => {
    patchHandler = () =>
      Promise.resolve(res({ detail: "Some settings need fixing", errors: [{ client_group_id: "g2", message: "Velvet Laser needs its own zones" }] }, 400))
    renderSettings()
    const clients = within(await screen.findByRole("region", { name: "Clients and targets settings" }))
    await userEvent.click(await clients.findByRole("button", { name: "Save changes" }))
    const message = await clients.findByText("Velvet Laser needs its own zones")
    expect(message.closest("tr")).toHaveTextContent("Velvet Laser")
  })

  it("the schedule and the creative rules save from here", async () => {
    renderSettings()
    const schedule = within(await screen.findByRole("region", { name: "Schedule settings" }))
    await userEvent.click(schedule.getByRole("button", { name: "Batch A Tue" }))
    await userEvent.click(schedule.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(bodies("/api/agents/ag1/settings", "PATCH")).toHaveLength(1))
    expect(bodies("/api/agents/ag1/settings", "PATCH")[0].settings.batches[0].weekdays).toEqual([0, 1, 3])

    const creative = within(screen.getByRole("region", { name: "Creative rules settings" }))
    await userEvent.clear(creative.getByLabelText("Most ads live in one ad set"))
    await userEvent.type(creative.getByLabelText("Most ads live in one ad set"), "5")
    await userEvent.click(creative.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(bodies("/api/agents/ag1/settings", "PATCH")).toHaveLength(2))
    expect(bodies("/api/agents/ag1/settings", "PATCH")[1].settings.creative.max_ads_live).toBe(5)
  })

  it("a live agent's Slack section keeps the note that anyone in the channel can approve", async () => {
    renderSettings()
    const slack = within(await screen.findByRole("region", { name: "Slack settings" }))
    expect(await slack.findByText(/Anyone in this channel can approve a card/)).toBeInTheDocument()
  })
})

describe("Agent settings: turning the agent off", () => {
  it("asks first, and does nothing when you decline", async () => {
    renderSettings()
    await userEvent.click(await screen.findByRole("button", { name: "Turn off" }))
    expect(await screen.findByText("Turn off this agent?")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(calls("/api/agents/ag1/deactivate", "POST")).toHaveLength(0)
  })

  it("turns it off once you confirm", async () => {
    renderSettings()
    await userEvent.click(await screen.findByRole("button", { name: "Turn off" }))
    await userEvent.click(await screen.findByRole("button", { name: "Turn off agent" }))
    await waitFor(() => expect(calls("/api/agents/ag1/deactivate", "POST")).toHaveLength(1))
  })

  it("a draft agent has nothing to turn off", async () => {
    agent = mkAgent({ status: "draft" })
    renderSettings()
    await screen.findByRole("region", { name: "Schedule settings" })
    expect(screen.queryByRole("button", { name: "Turn off" })).toBeNull()
  })
})

describe("Slack templates", () => {
  const open = async (name) => {
    const slack = within(await screen.findByRole("region", { name: "Slack settings" }))
    await userEvent.click(await slack.findByRole("button", { name: `Edit ${name}` }))
  }

  it("each template opens the editor with its own placeholders, and previews through the agent's route", async () => {
    renderSettings()
    await open("Card")
    expect(JSON.parse((await screen.findByLabelText("Report blocks")).value)).toEqual(DEFAULT_CARD)
    await screen.findByText("Glow Aesthetics")
    expect(bodies("/api/agents/ag1/slack-templates/card/preview", "POST")[0]).toEqual({ blocks: DEFAULT_CARD })
    await userEvent.click(screen.getByRole("button", { name: /insert value/i }))
    for (const name of ["client", "window", "zone"]) expect(await screen.findByRole("menuitem", { name: `{{${name}}}` })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "{{date}}" })).toBeNull()
  })

  it("the summary and weekly editors offer theirs", async () => {
    const { unmount } = renderSettings()
    await open("Daily summary")
    await userEvent.click(await screen.findByRole("button", { name: /insert value/i }))
    expect(await screen.findByRole("menuitem", { name: "{{batch}}" })).toBeInTheDocument()
    unmount()
    renderSettings()
    await open("Weekly message")
    await userEvent.click(await screen.findByRole("button", { name: /insert value/i }))
    expect(await screen.findByRole("menuitem", { name: "{{week}}" })).toBeInTheDocument()
  })

  it("the server's errors are listed and Save stays off", async () => {
    previewHandler = () => Promise.resolve(res({ detail: "This template can't be used", errors: ["block 1: unknown placeholder; the card template has {{client}}"] }, 400))
    renderSettings()
    await open("Card")
    const alert = await screen.findByRole("alert", {}, { timeout: 3000 })
    expect(within(alert).getByText(/unknown placeholder/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save template" })).toBeDisabled()
    // Agent templates have no report figures, so the editor doesn't offer them.
    expect(screen.getByText(/Values go in/)).toBeInTheDocument()
    expect(screen.queryByText(/ask Birdy to do it/i)).not.toBeInTheDocument()
  })

  it("Save sends the blocks and closes the editor", async () => {
    renderSettings()
    await open("Card")
    await screen.findByText("Glow Aesthetics")
    await userEvent.click(screen.getByRole("button", { name: "Save template" }))
    await waitFor(() => expect(bodies("/api/agents/ag1/slack-templates/card", "PUT")).toEqual([{ blocks: DEFAULT_CARD }]))
    await waitFor(() => expect(screen.queryByLabelText("Report blocks")).toBeNull())
  })

  it("Reset goes back to the default only after you confirm", async () => {
    const custom = [{ type: "divider" }]
    views.card = view("card", { customised: true, template: { blocks: custom } })
    renderSettings()
    await open("Card")
    expect(JSON.parse((await screen.findByLabelText("Report blocks")).value)).toEqual(custom)

    await userEvent.click(screen.getByRole("button", { name: "Reset to default" }))
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }))
    expect(calls("/api/agents/ag1/slack-templates/card", "DELETE")).toHaveLength(0)

    await userEvent.click(screen.getByRole("button", { name: "Reset to default" }))
    await userEvent.click(await screen.findByRole("button", { name: "Reset template" }))
    await waitFor(() => expect(calls("/api/agents/ag1/slack-templates/card", "DELETE")).toHaveLength(1))
    await waitFor(() => expect(JSON.parse(screen.getByLabelText("Report blocks").value)).toEqual(DEFAULT_CARD))
  })

  it("a saved template that failed shows the server's notice, and the default row has none", async () => {
    views.summary = view("summary", { customised: true, notice: "The summary template could not be used, so the default went out." })
    renderSettings()
    const slack = within(await screen.findByRole("region", { name: "Slack settings" }))
    expect(await slack.findByText(/default went out/)).toBeInTheDocument()
    expect(slack.getAllByText(/default went out/)).toHaveLength(1)
  })
})

describe("Lessons", () => {
  it("an empty list uses the mock's words", async () => {
    render(<Host><Lessons /></Host>)
    expect(
      await screen.findByText("Nothing yet. When you edit a card, overrule Birdy or comment on a card in Slack, the lesson shows up here, dated and yours to remove.")
    ).toBeInTheDocument()
  })

  it("overruling takes a lesson out of the active list", async () => {
    lessons = [
      { id: "l1", text: "Wait 3 days before judging new laser ads.", status: "active", source: "edit", client_group_id: "g2", created_at: "2026-10-30T08:00:00" },
      { id: "l2", text: "Never pause the hero video.", status: "active", source: "dismiss", created_at: "2026-10-31T08:00:00" },
    ]
    render(<Host><Lessons /></Host>)
    const active = within(await screen.findByRole("region", { name: "Lessons" }))
    expect(active.getByText(/Wait 3 days/)).toBeInTheDocument()
    await userEvent.click(active.getAllByRole("button", { name: "Overrule" })[0])
    await waitFor(() => expect(active.queryByText(/Wait 3 days/)).toBeNull())
    expect(active.getByText(/Never pause the hero video/)).toBeInTheDocument()
    const overruled = within(screen.getByRole("region", { name: "Overruled" }))
    expect(overruled.getByText(/Wait 3 days/)).toBeInTheDocument()
    expect(calls("/api/agents/ag1/lessons/l1/overrule", "POST")).toHaveLength(1)
  })
})


describe("Agent settings: a turned off agent", () => {
  const OFF = () => mkAgent({ status: "draft", turned_off_at: "2026-11-04T09:00:00" })

  it("says Turned off and offers Turn on, never setup or Start over", async () => {
    agent = OFF()
    renderSettings()
    expect(await screen.findByText("Turned off")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Turn on" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Turn off" })).toBeNull()
    expect(screen.queryByRole("button", { name: /Start over/ })).toBeNull()
    expect(screen.queryByText(/Finish setup/)).toBeNull()
  })

  it("Turn on calls activate with the flagged clients and nothing else", async () => {
    agent = { ...OFF(), scope: { ...OFF().scope, flag_only_client_group_ids: ["g2"] } }
    renderSettings()
    await userEvent.click(await screen.findByRole("button", { name: "Turn on" }))
    await waitFor(() => expect(bodies("/api/agents/ag1/activate", "POST")).toEqual([{ only_flag: ["g2"] }]))
  })

  it("lists what is missing", async () => {
    agent = OFF()
    activateHandler = () => Promise.resolve(res({ detail: "The agent isn't ready to switch on yet", missing: ["Pick a client", "Set zones for Velvet Laser"] }, 409))
    renderSettings()
    await userEvent.click(await screen.findByRole("button", { name: "Turn on" }))
    expect(await screen.findByText("Set zones for Velvet Laser")).toBeInTheDocument()
    expect(screen.getByText("Pick a client")).toBeInTheDocument()
  })

  it("when the preview is what's missing, the notice links to the setup preview step", async () => {
    agent = OFF()
    activateHandler = () => Promise.resolve(res({ detail: "not ready", missing: ["Preview the first report again: it doesn't cover every client you watch now"] }, 409))
    renderSettings()
    await userEvent.click(await screen.findByRole("button", { name: "Turn on" }))
    const link = await screen.findByRole("link", { name: "Open the preview step" })
    expect(link).toHaveAttribute("href", "/hub/agents/media-buying/setup?step=6")
  })

  it("no preview link when something else is missing", async () => {
    agent = OFF()
    activateHandler = () => Promise.resolve(res({ detail: "not ready", missing: ["Pick a client"] }, 409))
    renderSettings()
    await userEvent.click(await screen.findByRole("button", { name: "Turn on" }))
    await screen.findByText("Pick a client")
    expect(screen.queryByRole("link", { name: "Open the preview step" })).toBeNull()
  })

  it("names a client another agent now holds and moves it or only flags it", async () => {
    agent = OFF()
    activateHandler = vi
      .fn()
      .mockResolvedValueOnce(res({ detail: "held", conflicts: [{ client_group_id: "g2", holder_name: "Pause and revive rules" }] }, 409))
      .mockResolvedValue(res({ ...agent, status: "active" }))
    renderSettings()
    await userEvent.click(await screen.findByRole("button", { name: "Turn on" }))
    const conflict = (await screen.findByText(/is with Pause and revive rules/)).closest("li")
    expect(within(conflict).getByText("Velvet Laser")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Move it here" }))
    await waitFor(() => expect(bodies("/api/agents/ag1/activate", "POST")[1]).toEqual({ only_flag: [], move_claims: true }))
  })

  it("the confirm copy says what really happens", async () => {
    renderSettings()
    await userEvent.click(await screen.findByRole("button", { name: "Turn off" }))
    const text = (await screen.findByRole("alertdialog")).textContent
    expect(text).toMatch(/clients are released/)
    expect(text).toMatch(/can't be applied until it is on again/)
    expect(text).toMatch(/undone/)
    expect(text).toMatch(/without a new preview/)
    expect(text).not.toMatch(/Nothing in Meta is touched|from setup/)
  })
})

describe("Agent settings: saving details", () => {
  it("a schedule save on a live agent leaves the scope alone when the time and zone are unchanged", async () => {
    renderSettings()
    const schedule = within(await screen.findByRole("region", { name: "Schedule settings" }))
    await userEvent.click(schedule.getByRole("button", { name: "Batch A Tue" }))
    await userEvent.click(schedule.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(bodies("/api/agents/ag1/settings", "PATCH")).toHaveLength(1))
    expect(calls("/api/agents/ag1", "PATCH")).toHaveLength(0)
  })

  it("a claim conflict on the schedule is a readable message, and a half-saved schedule says so", async () => {
    const user = userEvent.setup()
    renderSettings()
    const schedule = within(await screen.findByRole("region", { name: "Schedule settings" }))
    fireEventTime(schedule.getByLabelText("Every day at"), "08:00")
    vi.mocked(apiRequest).mockImplementation((path, init = {}) =>
      path === "/api/agents/ag1" && init.method === "PATCH"
        ? Promise.resolve(res({ detail: "held", conflicts: [{ client_group_id: "g2", holder_name: "Rules" }] }, 409))
        : mockApi(path, init)
    )
    await user.click(schedule.getByRole("button", { name: "Save changes" }))
    expect(await schedule.findByText(/Another agent now handles some of your clients/)).toBeInTheDocument()
    expect(schedule.queryByText(/HTTP 409/)).toBeNull()

    vi.mocked(apiRequest).mockImplementation((path, init = {}) =>
      path === "/api/agents/ag1/settings" ? Promise.resolve(res({ detail: "nope" }, 500)) : mockApi(path, init)
    )
    await user.click(schedule.getByRole("button", { name: "Save changes" }))
    expect(await schedule.findByText(/The time and time zone were saved, but the days and weekly message weren't/)).toBeInTheDocument()
  })

  it("no Saved. when the Slack channel is as it was", async () => {
    renderSettings()
    const slack = within(await screen.findByRole("region", { name: "Slack settings" }))
    await userEvent.click(await slack.findByRole("button", { name: "Save changes" }))
    await new Promise((r) => setTimeout(r, 30))
    expect(slack.queryByText("Saved.")).toBeNull()
    expect(bodies("/api/agents/ag1/settings", "PATCH")).toHaveLength(0)
  })

  it("a refetch of the agent while a template is open doesn't preview again", async () => {
    const { rerender } = renderSettings()
    const slack = within(await screen.findByRole("region", { name: "Slack settings" }))
    await userEvent.click(await slack.findByRole("button", { name: "Edit Card" }))
    await screen.findByText("Glow Aesthetics")
    const before = calls("/api/agents/ag1/slack-templates/card/preview", "POST").length
    agent = { ...agent } // as a background refetch of the agent gives a new object
    rerender(<Host><Settings /></Host>)
    await new Promise((r) => setTimeout(r, 800))
    expect(calls("/api/agents/ag1/slack-templates/card/preview", "POST")).toHaveLength(before)
  })

  it("a save error goes away once the draft changes", async () => {
    const user = userEvent.setup()
    renderSettings()
    const slack = within(await screen.findByRole("region", { name: "Slack settings" }))
    await user.click(await slack.findByRole("button", { name: "Edit Card" }))
    await screen.findByText("Glow Aesthetics")
    vi.mocked(apiRequest).mockImplementation((path, init = {}) =>
      path === "/api/agents/ag1/slack-templates/card" && init.method === "PUT"
        ? Promise.resolve(res({ detail: "no", errors: ["block 1: nope"] }, 400))
        : mockApi(path, init)
    )
    await user.click(screen.getByRole("button", { name: "Save template" }))
    expect(await screen.findByText("block 1: nope")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Report blocks"), { target: { value: JSON.stringify([{ type: "divider" }]) } })
    await waitFor(() => expect(screen.queryByText("block 1: nope")).toBeNull(), { timeout: 3000 })
  })

  it("the summary's client table can be added back", async () => {
    const user = userEvent.setup()
    views.summary = view("summary", { placeholders: ["date"], template: { blocks: [{ type: "divider" }] } })
    renderSettings()
    const slack = within(await screen.findByRole("region", { name: "Slack settings" }))
    await user.click(await slack.findByRole("button", { name: "Edit Daily summary" }))
    await user.click(await screen.findByRole("button", { name: /add block/i }))
    await user.click(await screen.findByRole("menuitem", { name: /client table/i }))
    expect(JSON.parse(screen.getByLabelText("Report blocks").value)[1]).toEqual({ type: "table", birdy_data: { source: "agent_run" } })
  })
})

describe("Lessons: removed ones", () => {
  it("a lesson removed from memory is not listed as in force", async () => {
    lessons = [
      { id: "l1", text: "Keep this one.", status: "active", active: true, source: "edit", created_at: "2026-10-30T08:00:00" },
      { id: "l2", text: "Removed one.", status: "active", active: false, source: "edit", created_at: "2026-10-30T08:00:00" },
    ]
    render(<Host><Lessons /></Host>)
    const active = within(await screen.findByRole("region", { name: "Lessons" }))
    expect(active.getByText(/Keep this one/)).toBeInTheDocument()
    expect(screen.queryByText(/Removed one/)).toBeNull()
    expect(active.getByText("1")).toBeInTheDocument()
  })
})
