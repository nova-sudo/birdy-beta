// The toolbar's Filters control.
//
// It now carries every filter on a page. Previously some lived here and the
// rest were hidden inside the column-visibility menu, so "Filters" didn't show
// you all of them — these cover the two selection modes and the draft/apply
// contract that keeps a half-made selection from refetching the table.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FilterPanel } from "@/components/ui/Filterpanel.jsx"

function setup(overrides = {}) {
  const onSources = vi.fn()
  const onType = vi.fn()
  const groups = [
    {
      id: "sources", label: "Sources", mode: "multi",
      items: ["Facebook", "Google", "Referral"],
      value: overrides.sources ?? [], onChange: onSources,
    },
    {
      id: "types", label: "Types", mode: "single",
      items: ["Lead", "Contact"],
      value: overrides.type ?? "all", onChange: onType,
    },
  ]
  render(<FilterPanel groups={groups} />)
  return { user: userEvent.setup(), onSources, onType }
}

const open = async (user) =>
  user.click(screen.getByRole("button", { name: /filters/i }))

beforeEach(() => vi.clearAllMocks())

describe("opening", () => {
  it("shows a tab per filter group", async () => {
    const { user } = setup()
    await open(user)
    expect(screen.getByRole("button", { name: /^sources/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^types/i })).toBeInTheDocument()
  })

  it("lists the first group's options", async () => {
    const { user } = setup()
    await open(user)
    expect(screen.getByRole("checkbox", { name: "Facebook" })).toBeInTheDocument()
  })

  it("switches lists when another tab is picked", async () => {
    const { user } = setup()
    await open(user)
    await user.click(screen.getByRole("button", { name: /^types/i }))

    expect(screen.getByRole("radio", { name: "Lead" })).toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: "Facebook" })).not.toBeInTheDocument()
  })
})

describe("multi-select groups", () => {
  it("accumulates choices and commits them on Apply", async () => {
    const { user, onSources } = setup()
    await open(user)

    await user.click(screen.getByRole("checkbox", { name: "Facebook" }))
    await user.click(screen.getByRole("checkbox", { name: "Referral" }))
    await user.click(screen.getByRole("button", { name: /apply filters/i }))

    expect(onSources).toHaveBeenCalledWith(["Facebook", "Referral"])
  })

  it("unticks a chosen option", async () => {
    const { user, onSources } = setup({ sources: ["Facebook"] })
    await open(user)

    await user.click(screen.getByRole("checkbox", { name: "Facebook" }))
    await user.click(screen.getByRole("button", { name: /apply filters/i }))

    expect(onSources).toHaveBeenCalledWith([])
  })
})

describe("single-select groups", () => {
  it("keeps only the last choice", async () => {
    const { user, onType } = setup()
    await open(user)
    await user.click(screen.getByRole("button", { name: /^types/i }))

    await user.click(screen.getByRole("radio", { name: "Lead" }))
    await user.click(screen.getByRole("radio", { name: "Contact" }))
    await user.click(screen.getByRole("button", { name: /apply filters/i }))

    expect(onType).toHaveBeenCalledWith("Contact")
  })

  it("clicking the chosen one clears back to all", async () => {
    // Without this a single-select filter can only ever be narrowed, never undone.
    const { user, onType } = setup({ type: "Lead" })
    await open(user)
    await user.click(screen.getByRole("button", { name: /^types/i }))

    await user.click(screen.getByRole("radio", { name: "Lead" }))
    await user.click(screen.getByRole("button", { name: /apply filters/i }))

    expect(onType).toHaveBeenCalledWith("all")
  })

  it("renders as radios, not checkboxes", async () => {
    // The shape is the only cue that one choice replaces the others.
    const { user } = setup()
    await open(user)
    await user.click(screen.getByRole("button", { name: /^types/i }))
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0)
    expect(screen.getAllByRole("radio")).toHaveLength(2)
  })
})

describe("the draft contract", () => {
  it("does not notify the page until Apply", async () => {
    const { user, onSources } = setup()
    await open(user)

    await user.click(screen.getByRole("checkbox", { name: "Facebook" }))

    expect(onSources).not.toHaveBeenCalled()
  })

  it("commits every group, not just the visible one", async () => {
    const { user, onSources, onType } = setup()
    await open(user)

    await user.click(screen.getByRole("checkbox", { name: "Google" }))
    await user.click(screen.getByRole("button", { name: /^types/i }))
    await user.click(screen.getByRole("radio", { name: "Lead" }))
    await user.click(screen.getByRole("button", { name: /apply filters/i }))

    expect(onSources).toHaveBeenCalledWith(["Google"])
    expect(onType).toHaveBeenCalledWith("Lead")
  })
})

describe("counts", () => {
  it("totals active filters across groups on the trigger", async () => {
    setup({ sources: ["Facebook", "Google"], type: "Lead" })
    expect(
      within(screen.getByRole("button", { name: /filters/i })).getByText("3")
    ).toBeInTheDocument()
  })

  it("does not count a single-select sitting on all", () => {
    setup({ sources: ["Facebook"], type: "all" })
    expect(
      within(screen.getByRole("button", { name: /filters/i })).getByText("1")
    ).toBeInTheDocument()
  })

  it("shows no badge when nothing is filtered", () => {
    setup()
    const trigger = screen.getByRole("button", { name: /filters/i })
    expect(within(trigger).queryByText(/^\d+$/)).not.toBeInTheDocument()
  })
})

describe("clear", () => {
  it("empties only the group on screen", async () => {
    const { user, onSources, onType } = setup({ sources: ["Facebook"], type: "Lead" })
    await open(user)

    await user.click(screen.getByRole("button", { name: /^clear$/i }))
    await user.click(screen.getByRole("button", { name: /apply filters/i }))

    expect(onSources).toHaveBeenCalledWith([])
    expect(onType).toHaveBeenCalledWith("Lead")
  })
})

describe("search", () => {
  it("narrows the visible options", async () => {
    const { user } = setup()
    await open(user)

    await user.type(screen.getByLabelText(/search sources/i), "goo")

    expect(screen.getByRole("checkbox", { name: "Google" })).toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: "Facebook" })).not.toBeInTheDocument()
  })

  it("says so when nothing matches", async () => {
    const { user } = setup()
    await open(user)
    await user.type(screen.getByLabelText(/search sources/i), "zzz")
    expect(screen.getByText(/no results/i)).toBeInTheDocument()
  })

  it("resets when the tab changes", async () => {
    const { user } = setup()
    await open(user)

    await user.type(screen.getByLabelText(/search sources/i), "goo")
    await user.click(screen.getByRole("button", { name: /^types/i }))

    expect(screen.getByLabelText(/search types/i)).toHaveValue("")
    expect(screen.getByRole("radio", { name: "Lead" })).toBeInTheDocument()
  })
})

describe("option shapes", () => {
  it("accepts {value,label} objects as well as plain strings", async () => {
    const onChange = vi.fn()
    render(
      <FilterPanel
        groups={[{
          id: "status", label: "Status", mode: "single",
          items: [{ value: "won", label: "Won" }, { value: "lost", label: "Lost" }],
          value: "all", onChange,
        }]}
      />
    )
    const user = userEvent.setup()
    await open(user)

    await user.click(screen.getByRole("radio", { name: "Won" }))
    await user.click(screen.getByRole("button", { name: /apply filters/i }))

    expect(onChange).toHaveBeenCalledWith("won")
  })
})
