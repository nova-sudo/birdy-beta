import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/components/birdy/Birdy", () => ({ default: () => null }))
// recharts sizes its charts with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }

import SlackMessagePreview from "../SlackMessagePreview"
import { toRows } from "../SlackChart"

const raw = (text) => ({ type: "raw_text", text })
const num = (value, text) => ({ type: "raw_number", value, text })

describe("SlackMessagePreview", () => {
  it("draws every message block", () => {
    render(<SlackMessagePreview blocks={[
      { type: "header", text: { type: "plain_text", text: "Weekly" } },
      { type: "section", fields: [{ type: "mrkdwn", text: "*Spend*\n£180" }, { type: "mrkdwn", text: "*Leads*\n15" }],
        accessory: { type: "button", text: { type: "plain_text", text: "Open" }, url: "https://x.io" } },
      { type: "divider" },
      { type: "context", elements: [{ type: "mrkdwn", text: "small print" }] },
      { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Dashboard" }, url: "https://x.io", style: "primary" }] },
      { type: "rich_text", elements: [{ type: "rich_text_list", style: "bullet", elements: [{ type: "rich_text_section", elements: [{ type: "text", text: "point", style: { bold: true } }] }] }] },
      { type: "markdown", text: "**md bold**" },
      { type: "table", rows: [[raw("Client"), raw("Spend")], [raw("Glow"), num(120, "£120")]] },
      { type: "card", title: { type: "mrkdwn", text: "*Card title*" }, body: { type: "mrkdwn", text: "card body" } },
      { type: "carousel", elements: [{ type: "card", title: { type: "mrkdwn", text: "*Glow Clinic*" } }] },
      { type: "data_visualization", title: "Spend chart", chart: { type: "bar", series: [{ name: "Spend", data: [{ label: "A", value: 1 }] }], axis_config: { categories: ["A"] } } },
    ]} />)
    for (const text of ["Weekly", "Spend", "£180", "Open", "small print", "Dashboard", "point", "md bold", "£120", "Card title", "card body", "Glow Clinic", "Spend chart"]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0)
    }
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("https://x.io")
  })

  it("sorts and pages a data table", async () => {
    const rows = [[raw("Client"), raw("Spend")], ...[3, 1, 2, 5, 4, 6].map((n) => [raw(`C${n}`), num(n, `£${n}`)])]
    render(<SlackMessagePreview blocks={[{ type: "data_table", caption: "Clients", page_size: 5, rows }]} />)
    expect(screen.getByText("1 / 2")).toBeTruthy()
    expect(screen.queryByText("C6")).toBeNull()
    await userEvent.setup().click(screen.getByRole("button", { name: /spend/i }))
    expect(screen.getByText("C6")).toBeTruthy()            // biggest first
  })
})

describe("toRows", () => {
  it("turns Slack series into one row per category, negatives intact", () => {
    expect(toRows({
      axis_config: { categories: ["Mon", "Tue"] },
      series: [{ name: "Spend", data: [{ label: "Mon", value: 10 }, { label: "Tue", value: -5 }] },
               { name: "Leads", data: [{ label: "Mon", value: 2 }, { label: "Tue", value: 3 }] }],
    })).toEqual([{ label: "Mon", Spend: 10, Leads: 2 }, { label: "Tue", Spend: -5, Leads: 3 }])
  })
})
