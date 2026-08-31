import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AdsGallery, { AdsViewSwitch } from "@/components/campaigns/AdsGallery"

// The columns arrive exactly as MarketingContent's tableColumns: ordered,
// visible-only, name first, each with a render closure.
const COLUMNS = [
  { id: "name", header: "Name", render: v => v },
  { id: "spend", header: "Spend", render: v => `£${v}` },
  { id: "cpl", header: "CPL", render: v => `£${v}` },
  { id: "clicks", header: "Clicks", render: v => String(v) },
]

const ROWS = [
  { id: "ad1", name: "Summer Video", status: "active", spend: 100, cpl: 5, clicks: 40, creative_image: "" },
  { id: "ad2", name: "Winter Static", status: "paused", spend: 900, cpl: 9, clicks: 80, creative_image: "https://cdn.example/x.jpg" },
]

const setup = (props = {}) =>
  render(<AdsGallery rows={ROWS} columns={COLUMNS} {...props} />)

describe("AdsGallery", () => {
  it("renders a card per ad, spend-descending to match the table's default sort", () => {
    setup()
    const names = screen.getAllByTitle(/Summer Video|Winter Static/).map(el => el.textContent)
    expect(names).toEqual(["Winter Static", "Summer Video"])
  })

  it("shows every column except the name as a metric row, in column order", () => {
    setup()
    const card = screen.getByTitle("Summer Video").closest(".overflow-hidden")
    const labels = within(card).getAllByText(/^(Spend|CPL|Clicks)$/).map(el => el.textContent)
    expect(labels).toEqual(["Spend", "CPL", "Clicks"])
    expect(within(card).getByText("£100")).toBeInTheDocument()
  })

  it("uses the creative image when the row has one, the play placeholder when not", () => {
    setup()
    const imgs = screen.queryAllByRole("img")
    expect(imgs).toHaveLength(1)
    expect(imgs[0]).toHaveAttribute("src", "https://cdn.example/x.jpg")
  })

  it("wires the status toggle to the same handler the table uses", async () => {
    const user = userEvent.setup()
    const onStatusToggle = vi.fn()
    setup({ onStatusToggle })

    const toggle = screen.getByRole("switch", { name: /Pause Summer Video/ })
    expect(toggle).toHaveAttribute("aria-checked", "true")
    await user.click(toggle)
    expect(onStatusToggle).toHaveBeenCalledWith("ad1", "active")

    expect(screen.getByRole("switch", { name: /Activate Winter Static/ })).toHaveAttribute(
      "aria-checked", "false"
    )
  })

  it("emits the full reordered id list on a metric-row drop, name kept first", () => {
    const onOrderChange = vi.fn()
    setup({ onOrderChange })

    const card = screen.getByTitle("Summer Video").closest(".overflow-hidden")
    const spendRow = within(card).getByText("Spend").parentElement
    const clicksRow = within(card).getByText("Clicks").parentElement

    fireEvent.dragStart(spendRow)
    fireEvent.dragOver(clicksRow)
    fireEvent.drop(clicksRow)

    // Same shape StyledTable emits: ordered visible ids, dragged one respliced
    // in front of the target — this is what both layouts persist.
    expect(onOrderChange).toHaveBeenCalledWith(["name", "cpl", "spend", "clicks"])
  })

  it("drops on the row itself without emitting a change", () => {
    const onOrderChange = vi.fn()
    setup({ onOrderChange })

    const card = screen.getByTitle("Summer Video").closest(".overflow-hidden")
    const spendRow = within(card).getByText("Spend").parentElement

    fireEvent.dragStart(spendRow)
    fireEvent.drop(spendRow)
    expect(onOrderChange).not.toHaveBeenCalled()
  })

  it("says so when there are no ads", () => {
    render(<AdsGallery rows={[]} columns={COLUMNS} />)
    expect(screen.getByText("No ads to show")).toBeInTheDocument()
  })
})

describe("AdsViewSwitch", () => {
  it("offers the two layouts and reports the pick", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<AdsViewSwitch value="table" onChange={onChange} />)

    expect(screen.getByRole("radio", { name: "Table view" })).toHaveAttribute("aria-checked", "true")
    await user.click(screen.getByRole("radio", { name: "Gallery view" }))
    expect(onChange).toHaveBeenCalledWith("gallery")
  })
})
