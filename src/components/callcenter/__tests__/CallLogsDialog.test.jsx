import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CallLogsDialog } from "../CallLogsDialog"

const LEAD = {
  name: "Sarah Whitmore",
  email: "sarah@example.com",
  phone: "+441111",
  call_logs_count: 2,
  call_logs: [
    {
      caller_name: "Priya Shah",
      call_time: "21 Oct 2026, 14:32",
      call_status: "outbound",
      duration: 252,
      speed_to_lead: 30,
      group: "Acme",
      from_number: "111",
      to_number: "222",
      recording_url: "https://rec.example/1.mp3",
      transfer: true,
    },
    {
      caller_name: "Daniel Reid",
      call_time: "20 Oct 2026, 09:10",
      call_status: "inbound",
      duration: 60,
      from_number: "222",
      to_number: "111",
    },
  ],
}

describe("CallLogsDialog", () => {
  it("opens a ds Dialog with the stat strip", async () => {
    const user = userEvent.setup()
    render(<CallLogsDialog lead={LEAD} />)
    await user.click(screen.getByRole("button", { name: "2 calls" }))

    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveAttribute("data-ds", "dialog")
    expect(dialog).toHaveTextContent("Sarah Whitmore")
    // The strip comes first; the direction badges below reuse two of the words.
    const stat = (label) => within(dialog).getAllByText(label)[0].previousSibling
    expect(stat("Total calls")).toHaveTextContent("2")
    expect(stat("Inbound")).toHaveTextContent("1")
    expect(stat("Outbound")).toHaveTextContent("1")
    expect(stat("Talk time")).toHaveTextContent("5m 12s")
  })

  it("lists each call with direction, transfer flag and recording links", async () => {
    const user = userEvent.setup()
    render(<CallLogsDialog lead={LEAD} />)
    await user.click(screen.getByRole("button", { name: "2 calls" }))
    const dialog = await screen.findByRole("dialog")

    expect(within(dialog).getByText("Priya Shah")).toBeInTheDocument()
    expect(within(dialog).getByText("Transferred")).toBeInTheDocument()
    const play = within(dialog).getByRole("link", { name: /play/i })
    expect(play).toHaveAttribute("href", "https://rec.example/1.mp3")
    expect(play).toHaveAttribute("target", "_blank")
    expect(within(dialog).getByRole("link", { name: /download/i })).toHaveAttribute("download")
    // Only the call with a recording gets links.
    expect(within(dialog).getAllByRole("link")).toHaveLength(2)
  })

  it("says so when the lead has no logs", async () => {
    const user = userEvent.setup()
    render(<CallLogsDialog lead={{ ...LEAD, call_logs: [], call_logs_count: 1 }} />)
    await user.click(screen.getByRole("button", { name: "1 call" }))
    expect(await screen.findByText("No Call Logs")).toBeInTheDocument()
  })
})
