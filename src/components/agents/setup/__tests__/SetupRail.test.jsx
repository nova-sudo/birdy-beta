import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { SetupRail } from "../SetupRail"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const ALL_DONE = { purpose: true, playbook: true, clients: true, permissions: true, schedule: true, slack: true }
const agentWith = (steps) => ({
  id: "ag1",
  description: "Pause ads that cost too much",
  scope: { client_group_ids: ["g1"], schedule: { time: "07:00", tz: "Europe/London" } },
  permissions: { ads: true },
  training: { steps },
})

beforeEach(() => {
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation((path) =>
    Promise.resolve(path.endsWith("/rules") ? res([{ kind: "pause_over_target", enabled: true }]) : res({}))
  )
})

const renderRail = (props) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <SetupRail onChange={vi.fn()} onTurnOn={vi.fn()} {...props} />
    </SWRConfig>
  )

describe("SetupRail", () => {
  it("Turn on disabled until ready with unlock note", async () => {
    const onTurnOn = vi.fn()
    const { rerender } = renderRail({ agent: agentWith({}), confidence: { score: 10, ready: false }, onTurnOn })
    const button = screen.getByRole("button", { name: "Turn on" })
    expect(button).toBeDisabled()
    expect(screen.getByText("Unlocks once I've asked everything")).toBeInTheDocument()

    // Every step answered but the score isn't there yet: still locked.
    rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
        <SetupRail agent={agentWith(ALL_DONE)} confidence={{ score: 50, ready: false }} onChange={vi.fn()} onTurnOn={onTurnOn} />
      </SWRConfig>
    )
    expect(screen.getByRole("button", { name: "Turn on" })).toBeDisabled()

    rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
        <SetupRail agent={agentWith(ALL_DONE)} confidence={{ score: 90, ready: true }} onChange={vi.fn()} onTurnOn={onTurnOn} />
      </SWRConfig>
    )
    const on = screen.getByRole("button", { name: "Turn on" })
    expect(on).toBeEnabled()
    expect(screen.queryByText("Unlocks once I've asked everything")).not.toBeInTheDocument()
    await userEvent.click(on)
    expect(onTurnOn).toHaveBeenCalledTimes(1)
  })

  it("Change sends change message", async () => {
    const onChange = vi.fn()
    renderRail({ agent: agentWith({ purpose: true }), confidence: null, onChange })
    const purpose = screen.getByRole("listitem", { name: /What it does/ })
    expect(within(purpose).getByText("Pause ads that cost too much")).toBeInTheDocument()
    await userEvent.click(within(purpose).getByRole("button", { name: /Change/ }))
    expect(onChange).toHaveBeenCalledWith("purpose")

    const playbook = screen.getByRole("listitem", { name: /Its playbook/ })
    expect(within(playbook).getByText("Asking now")).toBeInTheDocument()
    expect(within(playbook).queryByRole("button", { name: /Change/ })).not.toBeInTheDocument()
  })

  it("n of 6 counts done steps", async () => {
    renderRail({ agent: agentWith({ purpose: true, playbook: true, clients: false }), confidence: null })
    expect(screen.getByText("2 of 6")).toBeInTheDocument()
    expect(await screen.findByText("1 rule")).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Steps done" })).toHaveAttribute("aria-valuenow", "2")
  })
})
