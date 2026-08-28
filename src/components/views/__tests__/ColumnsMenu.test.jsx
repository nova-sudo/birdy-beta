// The table toolbar's Columns menu (handoff concept 5C).
//
// `views` is the usePageViews shape, passed here as plain spies — the hook has
// its own tests, so these cover the menu's rules: the protected Default view,
// when the rename/delete affordances appear, and how source + search combine.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ColumnsMenu from "@/components/views/ColumnsMenu"

const COLUMNS = [
  { id: "spend",    label: "Spend",       source: "meta" },
  { id: "cpl",      label: "Cost / Lead", source: "meta" },
  { id: "ghl_won",  label: "Won",         source: "ghl" },
  { id: "tag_vip",  label: "Tag: VIP",    source: "tags" },
  { id: "roi",      label: "ROI",         source: "custom" },
]

const DEFAULTS = ["spend", "cpl"]

const view = (id, name, state = {}) => ({ id, name, state })

function makeViews(over = {}) {
  return {
    views: [],
    activeViewId: null,
    activeView: null,
    defaultViewId: null,
    loaded: true,
    saving: false,
    isDirty: false,
    applyView: vi.fn(),
    createView: vi.fn().mockResolvedValue(view("new", "New")),
    updateView: vi.fn().mockResolvedValue(view("a", "Renamed")),
    saveOverActiveView: vi.fn(),
    deleteView: vi.fn().mockResolvedValue(true),
    setDefault: vi.fn(),
    ...over,
  }
}

async function open(props = {}) {
  const user = userEvent.setup()
  const onChange = props.onChange ?? vi.fn()
  const views = props.views ?? makeViews()
  const onSaveDefault = props.onSaveDefault ?? vi.fn().mockResolvedValue(true)
  render(
    <ColumnsMenu
      columns={COLUMNS}
      visibleColumns={props.visibleColumns ?? DEFAULTS}
      onChange={onChange}
      defaultColumns={DEFAULTS}
      views={views}
      onSaveDefault={onSaveDefault}
      {...(props.sources ? { sources: props.sources } : {})}
    />
  )
  await user.click(screen.getByRole("button", { name: /columns/i }))
  return { user, onChange, views, onSaveDefault }
}

// The rename/delete icons only exist while their row is selected AND hovered.
// user-event's pointer move from the row label onto a freshly-revealed sibling
// unmounts it mid-gesture in jsdom — a real browser keeps the row hovered — so
// the reveal is driven with hover() and the click dispatched directly.
const clickRevealed = (name) => fireEvent.click(screen.getByRole("button", { name }))

beforeEach(() => vi.clearAllMocks())

describe("opening and closing", () => {
  it("is closed until the trigger is clicked", () => {
    render(
      <ColumnsMenu columns={COLUMNS} visibleColumns={DEFAULTS}
                   defaultColumns={DEFAULTS} views={makeViews()} />
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens on click", async () => {
    await open()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("closes on Escape", async () => {
    const { user } = await open()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

describe("the protected Default view", () => {
  it("always leads the rail, even with no saved views", async () => {
    await open()
    expect(screen.getByRole("button", { name: "Default" })).toBeInTheDocument()
  })

  it("cannot be renamed or deleted", async () => {
    await open()
    expect(screen.queryByRole("button", { name: /rename default/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /delete default/i })).not.toBeInTheDocument()
  })

  it("restores the page's baseline columns when picked", async () => {
    const { user, onChange, views } = await open({
      views: makeViews({
        views: [view("a", "Mine", { visibleColumns: ["roi"] })],
        activeViewId: "a",
      }),
      visibleColumns: ["roi"],
    })

    await user.click(screen.getByRole("button", { name: "Default" }))

    expect(onChange).toHaveBeenCalledWith(DEFAULTS)
    expect(views.applyView).toHaveBeenCalledWith(null)
  })

  it("can be saved over, writing the page's own layout", async () => {
    // Default is not a stored view, so there is nothing to PATCH — the
    // columns go to the page's own saved layout instead, which is what
    // brings them back next visit.
    const { user, onSaveDefault, views } = await open({ visibleColumns: ["spend", "roi"] })

    await user.click(screen.getByRole("button", { name: /save to existing/i }))

    await waitFor(() => expect(onSaveDefault).toHaveBeenCalledWith(["spend", "roi"]))
    expect(views.updateView).not.toHaveBeenCalled()
  })

  it("still offers Save New View", async () => {
    await open()
    expect(screen.getByRole("button", { name: /save new view/i })).toBeInTheDocument()
  })
})

describe("saved views", () => {
  it("lists them after Default", async () => {
    await open({ views: makeViews({ views: [view("a", "Meta only"), view("b", "Compact")] }) })
    expect(screen.getByRole("button", { name: "Meta only" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Compact" })).toBeInTheDocument()
  })

  it("applies one when clicked", async () => {
    const { user, views } = await open({ views: makeViews({ views: [view("a", "Meta only")] }) })
    await user.click(screen.getByRole("button", { name: "Meta only" }))
    expect(views.applyView).toHaveBeenCalledWith("a")
  })

  it("saves the current columns and source in place on Save to existing", async () => {
    const { user, views } = await open({
      views: makeViews({ views: [view("a", "Meta only")], activeViewId: "a" }),
      visibleColumns: ["spend", "roi"],
    })

    await user.click(screen.getByRole("button", { name: /save to existing/i }))

    await waitFor(() => expect(views.updateView).toHaveBeenCalledWith("a", {
      state: { visibleColumns: ["spend", "roi"], source: "all" },
    }))
  })

  it("does not write the page layout when a stored view is active", async () => {
    const { user, onSaveDefault } = await open({
      views: makeViews({ views: [view("a", "Meta only")], activeViewId: "a" }),
    })

    await user.click(screen.getByRole("button", { name: /save to existing/i }))

    await waitFor(() => expect(onSaveDefault).not.toHaveBeenCalled())
  })
})

describe("rename and delete affordances", () => {
  // The handoff is explicit: visible only when the row is BOTH selected and
  // hovered — not on hover alone, and not merely because it is selected.
  it("are absent on a selected row that is not hovered", async () => {
    await open({ views: makeViews({ views: [view("a", "Mine")], activeViewId: "a" }) })
    expect(screen.queryByRole("button", { name: /rename mine/i })).not.toBeInTheDocument()
  })

  it("are absent on a hovered row that is not selected", async () => {
    const { user } = await open({ views: makeViews({ views: [view("a", "Mine")] }) })
    await user.hover(screen.getByRole("button", { name: "Mine" }))
    expect(screen.queryByRole("button", { name: /rename mine/i })).not.toBeInTheDocument()
  })

  it("appear when the row is both selected and hovered", async () => {
    const { user } = await open({
      views: makeViews({ views: [view("a", "Mine")], activeViewId: "a" }),
    })
    await user.hover(screen.getByRole("button", { name: "Mine" }))
    expect(screen.getByRole("button", { name: /rename mine/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /delete mine/i })).toBeInTheDocument()
  })
})

describe("renaming", () => {
  it("swaps the row for an inline field and saves the new name", async () => {
    const { user, views } = await open({
      views: makeViews({ views: [view("a", "Mine")], activeViewId: "a" }),
    })
    await user.hover(screen.getByRole("button", { name: "Mine" }))
    clickRevealed(/rename mine/i)

    const field = screen.getByLabelText("View name")
    expect(field).toHaveValue("Mine")

    await user.clear(field)
    await user.type(field, "Renamed")
    await user.click(screen.getByRole("button", { name: /confirm rename/i }))

    expect(views.updateView).toHaveBeenCalledWith("a", { name: "Renamed" })
  })

  it("cancels without saving", async () => {
    const { user, views } = await open({
      views: makeViews({ views: [view("a", "Mine")], activeViewId: "a" }),
    })
    await user.hover(screen.getByRole("button", { name: "Mine" }))
    clickRevealed(/rename mine/i)
    await user.click(screen.getByRole("button", { name: /cancel rename/i }))

    expect(views.updateView).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Mine" })).toBeInTheDocument()
  })
})

describe("deleting", () => {
  it("asks for confirmation in the row before deleting", async () => {
    const { user, views } = await open({
      views: makeViews({ views: [view("a", "Mine")], activeViewId: "a" }),
    })
    await user.hover(screen.getByRole("button", { name: "Mine" }))
    clickRevealed(/delete mine/i)

    expect(screen.getByText(/delete “mine”\?/i)).toBeInTheDocument()
    expect(views.deleteView).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /^delete$/i }))
    expect(views.deleteView).toHaveBeenCalledWith("a")
  })

  it("backs out on Cancel", async () => {
    const { user, views } = await open({
      views: makeViews({ views: [view("a", "Mine")], activeViewId: "a" }),
    })
    await user.hover(screen.getByRole("button", { name: "Mine" }))
    clickRevealed(/delete mine/i)
    await user.click(screen.getByRole("button", { name: /^cancel$/i }))

    expect(views.deleteView).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Mine" })).toBeInTheDocument()
  })
})

describe("saving a new view", () => {
  it("sends the current columns and source", async () => {
    const { user, views } = await open({ visibleColumns: ["spend", "ghl_won"] })

    await user.click(screen.getByRole("button", { name: /save new view/i }))
    await user.type(screen.getByLabelText(/new view name/i), "My view")
    await user.click(screen.getByRole("button", { name: /^save$/i }))

    expect(views.createView).toHaveBeenCalledWith("My view", {
      visibleColumns: ["spend", "ghl_won"],
      source: "all",
    })
  })

  it("will not save an empty name", async () => {
    const { user, views } = await open()
    await user.click(screen.getByRole("button", { name: /save new view/i }))
    await user.click(screen.getByRole("button", { name: /^save$/i }))
    expect(views.createView).not.toHaveBeenCalled()
  })

  it("remembers the source the view was scoped to", async () => {
    const { user, views } = await open({ visibleColumns: ["ghl_won"] })

    await user.click(screen.getByRole("button", { name: "GHL" }))
    await user.click(screen.getByRole("button", { name: /save new view/i }))
    await user.type(screen.getByLabelText(/new view name/i), "GHL only")
    await user.click(screen.getByRole("button", { name: /^save$/i }))

    expect(views.createView).toHaveBeenCalledWith("GHL only", {
      visibleColumns: ["ghl_won"],
      source: "ghl",
    })
  })
})

describe("the column list", () => {
  it("toggles a column on", async () => {
    const { user, onChange } = await open({ visibleColumns: ["spend"] })
    await user.click(screen.getByRole("button", { name: /ROI/ }))
    expect(onChange).toHaveBeenCalledWith(["spend", "roi"])
  })

  it("toggles a column off", async () => {
    const { user, onChange } = await open({ visibleColumns: ["spend", "roi"] })
    await user.click(screen.getByRole("button", { name: /ROI/ }))
    expect(onChange).toHaveBeenCalledWith(["spend"])
  })

  it("narrows to one source", async () => {
    const { user } = await open()
    await user.click(screen.getByRole("button", { name: "GHL" }))

    expect(screen.getByRole("button", { name: /Won/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Cost \/ Lead/ })).not.toBeInTheDocument()
  })

  it("combines the source filter with the search box", async () => {
    const { user } = await open()
    await user.click(screen.getByRole("button", { name: "Meta" }))
    await user.type(screen.getByLabelText(/search metrics/i), "cost")

    expect(screen.getByRole("button", { name: /Cost \/ Lead/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Spend/ })).not.toBeInTheDocument()
  })

  it("says so when nothing matches", async () => {
    const { user } = await open()
    await user.type(screen.getByLabelText(/search metrics/i), "zzzz")
    expect(screen.getByText(/no metrics match/i)).toBeInTheDocument()
  })

  it("labels the search box with the active source", async () => {
    const { user } = await open()
    await user.click(screen.getByRole("button", { name: "Tags" }))
    expect(screen.getByPlaceholderText("Search in Tags…")).toBeInTheDocument()
  })
})

describe("select all", () => {
  it("turns on every column currently listed", async () => {
    const { user, onChange } = await open({ visibleColumns: [] })
    await user.click(screen.getByRole("button", { name: /metric name/i }))
    expect(onChange).toHaveBeenCalledWith(["spend", "cpl", "ghl_won", "tag_vip", "roi"])
  })

  it("acts only on the filtered subset, leaving hidden ones untouched", async () => {
    const { user, onChange } = await open({ visibleColumns: ["roi"] })
    await user.click(screen.getByRole("button", { name: "Meta" }))
    await user.click(screen.getByRole("button", { name: /metric name/i }))

    // "roi" is not in the Meta list, so it survives.
    expect(onChange).toHaveBeenCalledWith(["roi", "spend", "cpl"])
  })

  it("clears the filtered subset when all of it is already on", async () => {
    const { user, onChange } = await open({ visibleColumns: ["spend", "cpl", "roi"] })
    await user.click(screen.getByRole("button", { name: "Meta" }))
    await user.click(screen.getByRole("button", { name: /metric name/i }))

    expect(onChange).toHaveBeenCalledWith(["roi"])
  })
})

describe("custom source lists", () => {
  it("renders the sources it was given", async () => {
    await open({
      sources: [
        { id: "all", label: "All" },
        { id: "hotprospector", label: "HP" },
      ],
    })
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByRole("button", { name: "HP" })).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: "GHL" })).not.toBeInTheDocument()
  })
})


describe("nothing persists on toggle", () => {
  it("a column toggle never saves on its own", async () => {
    // Exploring which columns you want must not quietly overwrite the view
    // you were on — that is the whole point of the explicit save.
    const { user, onSaveDefault, views } = await open({
      views: makeViews({ views: [view("a", "Mine")], activeViewId: "a" }),
    })

    await user.click(screen.getByRole("button", { name: /ROI/ }))

    expect(onSaveDefault).not.toHaveBeenCalled()
    expect(views.updateView).not.toHaveBeenCalled()
  })

  it("select-all does not save either", async () => {
    const { user, onSaveDefault, views } = await open()
    await user.click(screen.getByRole("button", { name: /metric name/i }))
    expect(onSaveDefault).not.toHaveBeenCalled()
    expect(views.updateView).not.toHaveBeenCalled()
  })
})
