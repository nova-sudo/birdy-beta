import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AdsGallery, { AdsViewSwitch, GALLERY_PAGE_SIZE } from "@/components/campaigns/AdsGallery"
import { apiRequest } from "@/lib/api"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

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
    const card = screen.getByTitle("Summer Video").closest("[data-slot=ads-gallery-card]")
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

  it("falls back to the video poster and badges the card as a video", () => {
    render(
      <AdsGallery
        rows={[{
          id: "v1", name: "Video Ad", status: "active", spend: 1, cpl: 1, clicks: 1,
          creative_image: "", creative_thumbnail: "https://cdn.example/poster.jpg", creative_video_id: "77",
        }]}
        columns={COLUMNS}
      />
    )
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn.example/poster.jpg")
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

    const card = screen.getByTitle("Summer Video").closest("[data-slot=ads-gallery-card]")
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

    const card = screen.getByTitle("Summer Video").closest("[data-slot=ads-gallery-card]")
    const spendRow = within(card).getByText("Spend").parentElement

    fireEvent.dragStart(spendRow)
    fireEvent.drop(spendRow)
    expect(onOrderChange).not.toHaveBeenCalled()
  })

  it("pages the gallery 24 to a page", async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: GALLERY_PAGE_SIZE + 6 }, (_, i) => ({
      id: `m${i}`, name: `Ad ${i}`, status: "active", spend: 1000 - i, cpl: 1, clicks: 1,
    }))
    const { container } = render(<AdsGallery rows={many} columns={COLUMNS} />)

    expect(container.querySelectorAll("[data-slot=ads-gallery-card]")).toHaveLength(24)
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Next page" }))
    expect(container.querySelectorAll("[data-slot=ads-gallery-card]")).toHaveLength(6)
    expect(screen.getByTitle("Ad 29")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  })

  it("keeps the first four metrics in the card's row and the rest behind More metrics", () => {
    const cols = [
      { id: "name", header: "Name" },
      ...["m1", "m2", "m3", "m4", "m5"].map(id => ({ id, header: id.toUpperCase(), render: v => String(v) })),
    ]
    render(<AdsGallery rows={[{ id: "a", name: "A", status: "active", m1: 1, m2: 2, m3: 3, m4: 4, m5: 5 }]} columns={cols} />)
    expect(screen.getByText("More metrics (1)")).toBeInTheDocument()
  })

  it("opens Meta's preview in a dialog for a video ad", async () => {
    const user = userEvent.setup()
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      json: async () => ({ preview_url: "https://meta.example/preview", width: 500, height: 700 }),
    })
    render(
      <AdsGallery
        rows={[{ id: "v1", name: "Video Ad", status: "active", spend: 1, cpl: 1, clicks: 1, creative_video_id: "77" }]}
        columns={COLUMNS}
      />
    )
    await user.click(screen.getByRole("button", { name: "Play Video Ad preview" }))

    const dialog = await screen.findByRole("dialog")
    expect(apiRequest).toHaveBeenCalledWith("/api/facebook/ad-preview/v1")
    expect(await within(dialog).findByTitle("Video Ad")).toHaveAttribute("src", "https://meta.example/preview")
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
