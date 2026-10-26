import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormulaMetricPicker } from "../FormulaMetricPicker"

const metrics = [
  { id: "meta_spend", label: "Meta Spend", category: "Meta Ads" },
  { id: "ghl_contacts", label: "GHL Contacts", category: "GoHighLevel" },
  { id: "ghl_revenue", label: "GHL Revenue", category: "GoHighLevel" },
]

describe("FormulaMetricPicker", () => {
  it("lists metrics as checkbox items and reports the chosen id", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FormulaMetricPicker metrics={metrics} placeholder="+ Add Metric" onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: "+ Add Metric" }))
    expect(screen.getAllByRole("menuitemcheckbox")).toHaveLength(3)

    await user.click(screen.getByRole("menuitemcheckbox", { name: "GHL Revenue" }))
    expect(onChange).toHaveBeenCalledWith("ghl_revenue")
  })

  it("narrows by category chip and by search", async () => {
    const user = userEvent.setup()
    render(<FormulaMetricPicker metrics={metrics} placeholder="+ Add Metric" onChange={() => {}} />)

    await user.click(screen.getByRole("button", { name: "+ Add Metric" }))
    await user.click(screen.getByRole("button", { name: /GoHighLevel/ }))
    expect(screen.getAllByRole("menuitemcheckbox")).toHaveLength(2)

    await user.type(screen.getByLabelText("Search metrics"), "rev")
    expect(screen.getAllByRole("menuitemcheckbox")).toHaveLength(1)
    expect(screen.getByRole("menuitemcheckbox", { name: "GHL Revenue" })).toBeInTheDocument()
  })

  it("ticks the selected metric", async () => {
    const user = userEvent.setup()
    render(<FormulaMetricPicker metrics={metrics} value="meta_spend" onChange={() => {}} />)

    await user.click(screen.getByRole("button", { name: "Meta Spend" }))
    expect(screen.getByRole("menuitemcheckbox", { name: "Meta Spend" })).toBeChecked()
  })
})
