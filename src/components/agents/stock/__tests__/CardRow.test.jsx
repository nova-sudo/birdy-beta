import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }))

import { upload } from "@vercel/blob/client"
import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { parseServerDate, useStockActions } from "@/lib/stock-agent-api"
import { CardRow } from "../CardRow"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const line = (over = {}) => ({ id: "l1", kind: "remove", ad_name: "Static Offer - 082526 - Win", mode: "ask", state: "proposed", error: null, flags: [], meta_ids: ["111"], ...over })
const mkCard = (over = {}) => ({
  id: "c1",
  client_group_id: "g1",
  client_name: "Harbour Body Co",
  tag: "changes",
  zone: "red",
  status: "open",
  can_apply: true,
  currency: "GBP",
  previous_cpl: 9.85,
  current_cpl: 11.62,
  window: { start: "2026-10-27", end: "2026-11-02", prev_start: "2026-10-20", prev_end: "2026-10-26" },
  lines: [line()],
  additional_changes: "",
  thought_process: "CPL moved into red.",
  next_steps: "Evaluate on Friday.",
  ...over,
})

function Row({ card, ...rest }) {
  const actions = useStockActions("ag1")
  return <CardRow card={card} actions={actions} {...rest} />
}
const renderRow = (card, rest = {}) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <Row card={card} {...rest} />
    </SWRConfig>
  )

const calls = (path, method) => vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === path && (init?.method ?? "GET") === method)
const bodies = (path, method) => calls(path, method).map(([, init]) => JSON.parse(init.body))
const btn = (name) => screen.queryByRole("button", { name })
const expand = (name = /Harbour Body Co/) => userEvent.click(screen.getByRole("button", { name }))

let answers
beforeEach(() => {
  answers = {}
  // No video decoding here: measuring the file fails at once, which the upload treats as non-fatal.
  URL.createObjectURL = () => {
    throw new Error("not in jsdom")
  }
  vi.mocked(upload).mockReset()
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
    const hit = answers[`${init.method ?? "GET"} ${path}`]
    if (hit) return Promise.resolve(hit)
    return Promise.resolve(res({}, 404))
  })
})

describe("CardRow", () => {
  it("starts collapsed and opens on the row", async () => {
    renderRow(mkCard())
    expect(screen.queryByText("CPL moved into red.")).not.toBeInTheDocument()
    expect(btn(/Harbour Body Co/)).toHaveAttribute("aria-expanded", "false")
    await expand()
    expect(screen.getByText("CPL moved into red.")).toBeInTheDocument()
    expect(btn(/Harbour Body Co/)).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("£9.85")).toBeInTheDocument()
    expect(screen.getByText("£11.62")).toBeInTheDocument()
    expect(screen.getByText(/Remove - Static Offer/)).toBeInTheDocument()
  })

  it("open shows Edit, Dismiss and Apply, and Apply applies the card", async () => {
    answers["POST /api/agents/ag1/cards/c1/apply"] = res({ ok: true, outcome: "applied", reason: null, lines: [] })
    renderRow(mkCard())
    expect(btn("Edit")).toBeInTheDocument()
    expect(btn("Dismiss")).toBeInTheDocument()
    await userEvent.click(btn("Apply"))
    await waitFor(() => expect(bodies("/api/agents/ag1/cards/c1/apply", "POST")).toEqual([{}]))
  })

  it("Apply shows the reason a refused card gives", async () => {
    answers["POST /api/agents/ag1/cards/c1/apply"] = res({ detail: "A newer card replaced this one." }, 409)
    renderRow(mkCard())
    await userEvent.click(btn("Apply"))
    expect(await screen.findByText("A newer card replaced this one.")).toBeInTheDocument()
  })

  it("Apply shows a blocked answer's reason, which comes back as a 200", async () => {
    answers["POST /api/agents/ag1/cards/c1/apply"] = res({ ok: false, outcome: "blocked", reason: "Meta said no.", lines: [] })
    renderRow(mkCard())
    await userEvent.click(btn("Apply"))
    expect(await screen.findByText("Meta said no.")).toBeInTheDocument()
  })

  it("Dismiss takes an optional reason, which becomes a lesson", async () => {
    answers["POST /api/agents/ag1/cards/c1/dismiss"] = res({ ok: true, outcome: "dismissed", reason: null, lines: [] })
    renderRow(mkCard())
    await userEvent.click(btn("Dismiss"))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox"), "Client asked to wait")
    await userEvent.click(within(dialog).getByRole("button", { name: "Dismiss card" }))
    await waitFor(() => expect(bodies("/api/agents/ag1/cards/c1/dismiss", "POST")).toEqual([{ reason: "Client asked to wait" }]))
  })

  it("Edit saves only what changed and can take a line off", async () => {
    answers["PATCH /api/agents/ag1/cards/c1"] = res({})
    renderRow(mkCard({ lines: [line(), line({ id: "l2", ad_name: "Keep Me", kind: "add" })] }))
    await userEvent.click(btn("Edit"))
    const dialog = await screen.findByRole("dialog")
    const next = within(dialog).getByLabelText("The next steps")
    await userEvent.clear(next)
    await userEvent.type(next, "Look again Monday")
    await userEvent.click(within(dialog).getByRole("button", { name: /Take off Static Offer/ }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(bodies("/api/agents/ag1/cards/c1", "PATCH")).toEqual([{ lines: [{ id: "l2" }], next_steps: "Look again Monday" }])
    )
  })

  it("Edit can't take off a line already in Meta's hands, and keeps a refusal on screen", async () => {
    answers["PATCH /api/agents/ag1/cards/c1"] = res({ detail: "This card changed while you were editing it. Reload it" }, 409)
    renderRow(mkCard({ lines: [line({ state: "failed" }), line({ id: "l2", ad_name: "Keep Me", kind: "add" })] }))
    await userEvent.click(btn("Edit"))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).queryByRole("button", { name: /Take off Static Offer/ })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: /Take off Keep Me/ }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    expect(await within(dialog).findByText(/changed while you were editing/)).toBeInTheDocument()
  })

  it("needs_file shows Upload video, uploads under the grant's path_prefix and attaches the file", async () => {
    answers["POST /api/creatives/upload-grant"] = res({ grant: "G", path_prefix: "creatives/u-abc/" })
    answers["POST /api/agents/ag1/cards/c1/lines/l1/file"] = res({ ok: true, outcome: "attached", reason: null, lines: [] })
    vi.mocked(upload).mockResolvedValue({ url: "https://x.public.blob.vercel-storage.com/creatives/u-abc/v.mp4" })
    renderRow(mkCard({ lines: [line({ kind: "add", state: "needs_file", reason_code: "needs_file", error: "Upload it." })] }))
    await expand()
    expect(screen.getByText(/Meta won't share this file/)).toBeInTheDocument()
    expect(btn("Upload video")).toBeInTheDocument()
    await userEvent.upload(screen.getByLabelText(/Video for Static Offer/), new File(["x"], "v.mp4", { type: "video/mp4" }))
    await waitFor(() =>
      expect(bodies("/api/agents/ag1/cards/c1/lines/l1/file", "POST")).toEqual([
        { blob_url: "https://x.public.blob.vercel-storage.com/creatives/u-abc/v.mp4" },
      ])
    )
    expect(vi.mocked(upload).mock.calls[0][0]).toMatch(/^creatives\/u-abc\/.+-v\.mp4$/)
    expect(await screen.findByText(/Press Apply to post this ad/)).toBeInTheDocument()
  })

  it("a failed upload says why and attaches nothing", async () => {
    answers["POST /api/creatives/upload-grant"] = res({ detail: "Uploads are off." }, 503)
    renderRow(mkCard({ lines: [line({ kind: "add", state: "needs_file", reason_code: "needs_file" })] }))
    await expand()
    await userEvent.upload(screen.getByLabelText(/Video for Static Offer/), new File(["x"], "v.mp4", { type: "video/mp4" }))
    expect(await screen.findByText("Uploads are off.")).toBeInTheDocument()
    expect(calls("/api/agents/ag1/cards/c1/lines/l1/file", "POST")).toHaveLength(0)
  })

  it("failed shows the error and Retry, which names the line", async () => {
    answers["POST /api/agents/ag1/cards/c1/apply"] = res({ ok: true, outcome: "applied", reason: null, lines: [] })
    renderRow(mkCard({ can_apply: false, status: "partly_applied", lines: [line({ state: "failed", error: "Meta rejected the ad: bad image." })] }))
    await expand()
    expect(screen.getByText("Meta rejected the ad: bad image.")).toBeInTheDocument()
    await userEvent.click(btn("Retry"))
    await waitFor(() => expect(bodies("/api/agents/ag1/cards/c1/apply", "POST")).toEqual([{ line_ids: ["l1"] }]))
  })

  it("a collapsed card still says a line needs someone", () => {
    renderRow(mkCard({ can_apply: false, lines: [line({ state: "failed", error: "Bad." })] }))
    expect(screen.getByText("1 needs you")).toBeInTheDocument()
  })

  it("blocked shows the reason in plain words, or the server's for a new code", async () => {
    const { unmount } = renderRow(mkCard({ lines: [line({ state: "blocked", reason_code: "last_live_ad", error: "raw" })] }))
    await expand()
    expect(screen.getByText(/would leave its ad set with no live ads/)).toBeInTheDocument()
    unmount()
    renderRow(mkCard({ lines: [line({ state: "blocked", reason_code: "brand_new", error: "A brand new reason." })] }))
    await expand()
    expect(screen.getByText("A brand new reason.")).toBeInTheDocument()
  })

  it("applied shows Undo while possible, and undoes that line", async () => {
    answers["POST /api/agents/ag1/cards/c1/undo"] = res({ ok: true, outcome: "undone", reason: null, lines: [] })
    const until = new Date(Date.now() + 3600_000).toISOString()
    renderRow(mkCard({ status: "applied", can_apply: false, lines: [line({ state: "applied", undo_until: until })] }))
    await expand()
    await userEvent.click(btn("Undo"))
    await waitFor(() => expect(bodies("/api/agents/ag1/cards/c1/undo", "POST")).toEqual([{ line_id: "l1" }]))
  })

  it("applied shows no Undo once the window has passed", async () => {
    const until = new Date(Date.now() - 60_000).toISOString()
    renderRow(mkCard({ status: "applied", can_apply: false, lines: [line({ state: "applied", undo_until: until })] }))
    await expand()
    expect(screen.getByText("Applied", { selector: "li *" })).toBeInTheDocument()
    expect(btn("Undo")).not.toBeInTheDocument()
  })

  it("the undo window falls back to 24 hours from when it was applied", async () => {
    renderRow(mkCard({ status: "applied", can_apply: false, lines: [line({ state: "applied", applied_at: new Date(Date.now() - 3600_000).toISOString() })] }))
    await expand()
    expect(btn("Undo")).toBeInTheDocument()
  })

  it("reads the server's zoneless times as UTC", () => {
    expect(parseServerDate("2026-11-03T10:00:00").toISOString()).toBe("2026-11-03T10:00:00.000Z")
    expect(parseServerDate("2026-11-03T10:00:00.123456").toISOString()).toBe("2026-11-03T10:00:00.123Z")
    expect(parseServerDate("2026-11-03T10:00:00+02:00").toISOString()).toBe("2026-11-03T08:00:00.000Z")
    expect(parseServerDate(null)).toBeNull()
  })

  it("Flag shows no Apply", async () => {
    renderRow(mkCard({ status: "flagged", can_apply: false, lines: [line({ mode: "flag", state: "flagged" })] }))
    expect(btn("Apply")).not.toBeInTheDocument()
    expect(btn("Edit")).toBeInTheDocument()
    await expand()
    expect(screen.getByText(/only points it out/)).toBeInTheDocument()
  })

  it("a mixed card offers Apply for its Ask me line and shows each line's mode", async () => {
    renderRow(mkCard({ lines: [line({ mode: "flag", state: "flagged" }), line({ id: "l2", ad_name: "Ask One", kind: "add" })] }))
    expect(btn("Apply")).toBeInTheDocument()
    await expand()
    expect(screen.getByText("Flag")).toBeInTheDocument()
    expect(screen.getByText("Ask me")).toBeInTheDocument()
  })

  it("superseded shows Replaced by a newer card and no actions", async () => {
    renderRow(mkCard({ status: "superseded", can_apply: false, lines: [line(), line({ id: "l2", state: "failed", error: "x" }), line({ id: "l3", state: "needs_file" })] }))
    expect(screen.getByText("Replaced by a newer card")).toBeInTheDocument()
    await expand()
    for (const name of ["Edit", "Dismiss", "Apply", "Retry", "Undo", "Upload video"]) expect(btn(name)).not.toBeInTheDocument()
  })

  it("a dismissed card has no actions", async () => {
    renderRow(mkCard({ status: "dismissed", can_apply: false }))
    expect(screen.getByText("Dismissed")).toBeInTheDocument()
    for (const name of ["Edit", "Dismiss", "Apply"]) expect(btn(name)).not.toBeInTheDocument()
  })

  it("a partly applied card can be dismissed but not edited", () => {
    renderRow(mkCard({ status: "partly_applied", lines: [line({ state: "applied" }), line({ id: "l2", kind: "add" })] }))
    expect(btn("Edit")).not.toBeInTheDocument()
    expect(btn("Dismiss")).toBeInTheDocument()
    expect(btn("Apply")).toBeInTheDocument()
  })

  it("an open card with only a file to wait for has no Apply", () => {
    renderRow(mkCard({ lines: [line({ kind: "add", state: "needs_file" })] }))
    expect(btn("Apply")).not.toBeInTheDocument()
  })

  it("an Add left paused says the ad exists, is paused and where to find it", async () => {
    renderRow(mkCard({
      status: "partly_applied",
      can_apply: false,
      lines: [line({ kind: "add", state: "failed", reason_code: "no_destination", error: "The other ads aren't live.", paused_ad_id: "987" })],
    }))
    await expand()
    expect(screen.getByText("The other ads aren't live.")).toBeInTheDocument()
    expect(screen.getByText(/exists and is paused in Meta/)).toHaveTextContent(/Ads Manager.*987/)
  })

  it("left_paused keeps the server's words, which say whether the ad is sure to exist", async () => {
    const maybe = "Birdy may have created this ad, and if so it's paused in Meta."
    renderRow(mkCard({ status: "superseded", can_apply: false, lines: [line({ kind: "add", state: "failed", reason_code: "left_paused", error: maybe, meta_ids: [] })] }))
    await expand()
    expect(screen.getByText(maybe)).toBeInTheDocument()
    expect(screen.queryByText(/exists and is paused/)).not.toBeInTheDocument()
    expect(screen.getByText(/search for .*Static Offer.* in this client's Ads Manager/)).toBeInTheDocument()
  })

  it("shows a line's own note and flags", async () => {
    renderRow(mkCard({ lines: [line({ state: "applied", note: "Already done in Meta. Nothing changed.", flags: [{ kind: "client_name", note: "Mentions another client: Velvet" }] })] }))
    await expand()
    expect(screen.getByText("Already done in Meta. Nothing changed.")).toBeInTheDocument()
    expect(screen.getByText("Mentions another client: Velvet")).toBeInTheDocument()
  })

  it("read only: a preview card has no actions", async () => {
    renderRow(mkCard({ preview: true, can_apply: false, lines: [line({ state: "needs_file" }), line({ id: "l2", state: "failed", error: "x" })] }), { readOnly: true })
    await expand()
    for (const name of ["Edit", "Dismiss", "Apply", "Retry", "Undo", "Upload video"]) expect(btn(name)).not.toBeInTheDocument()
  })

  it("shows No data for a missing CPL and the card's own currency", async () => {
    renderRow(mkCard({ currency: "EUR", previous_cpl: 4.2, current_cpl: null }))
    await expand()
    expect(screen.getByText("€4.20")).toBeInTheDocument()
    expect(screen.getByText("No data")).toBeInTheDocument()
  })
})
