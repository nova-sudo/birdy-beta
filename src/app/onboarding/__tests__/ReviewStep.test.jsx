import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "", poppins: { variable: "" }, inter: { variable: "" } }))

import ReviewStep from "../ReviewStep"

const onImport = vi.fn()

const account = (location_id, name, extra = {}) => ({
  location_id,
  name,
  already_imported: false,
  leads_recent_90: true,
  leads_recent_7: false,
  last_lead_at: "2026-09-01T00:00:00Z",
  status_default: "active",
  fb_match: null,
  ...extra,
})

const REVIEW = {
  prep: { status: "done" },
  stats: {},
  fb_accounts: [
    { id: "act_1", name: "Aura - Ad Account" },
    { id: "act_2", name: "Plush - Ad Account" },
  ],
  accounts: [
    account("loc_1", "Aura", { fb_match: { id: "act_1", name: "Aura - Ad Account" } }),
    account("loc_2", "Plush Aesthetics", {
      fb_match: { id: "act_2", name: "Plush - Ad Account" },
      leads_recent_7: true,
    }),
    account("loc_3", "Lucy Jones PMU"),
  ],
}

function renderStep() {
  return render(
    <ReviewStep review={REVIEW} settled importing={false} onImport={onImport} />
  )
}

beforeEach(() => onImport.mockClear())

describe("sub-accounts review search", () => {
  it("lists every sub-account before anything is typed", () => {
    renderStep()
    expect(screen.getByDisplayValue("Aura")).toBeTruthy()
    expect(screen.getByDisplayValue("Plush Aesthetics")).toBeTruthy()
    expect(screen.getByDisplayValue("Lucy Jones PMU")).toBeTruthy()
  })

  it("narrows the table to matching sub-accounts", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(screen.getByPlaceholderText(/search 3 sub-accounts/i), "lucy")

    expect(screen.getByDisplayValue("Lucy Jones PMU")).toBeTruthy()
    expect(screen.queryByDisplayValue("Aura")).toBeNull()
    expect(screen.queryByDisplayValue("Plush Aesthetics")).toBeNull()
  })

  it("also matches on the ad account, since pairing is the job here", async () => {
    const user = userEvent.setup()
    renderStep()

    // "Plush - Ad Account" is the Facebook side; the GHL name is "Plush
    // Aesthetics", so this only passes if the ad-account name is searched too.
    await user.type(screen.getByPlaceholderText(/search 3 sub-accounts/i), "plush - ad")

    expect(screen.getByDisplayValue("Plush Aesthetics")).toBeTruthy()
    expect(screen.queryByDisplayValue("Aura")).toBeNull()
  })

  it("says so when nothing matches, rather than showing an empty table", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(screen.getByPlaceholderText(/search 3 sub-accounts/i), "zzzz")

    expect(screen.getByText(/no sub-account or ad account matches/i)).toBeTruthy()
  })

  it("keeps a hidden row's tick counted, and says that it did", async () => {
    const user = userEvent.setup()
    renderStep()
    // Plush is pre-checked (a lead in the last 7 days), so it is in the import
    // count. Searching past it must not quietly drop it.
    expect(screen.getByRole("button", { name: /import 1 sub-account/i })).toBeTruthy()

    await user.type(screen.getByPlaceholderText(/search 3 sub-accounts/i), "aura")

    expect(screen.getByRole("button", { name: /import 1 sub-account/i })).toBeTruthy()
    expect(screen.getByText(/1 selected row is hidden by this search/i)).toBeTruthy()
  })

  it("restores the full list when the search is cleared", async () => {
    const user = userEvent.setup()
    renderStep()
    const box = screen.getByPlaceholderText(/search 3 sub-accounts/i)

    await user.type(box, "aura")
    await user.clear(box)

    expect(screen.getByDisplayValue("Lucy Jones PMU")).toBeTruthy()
    expect(screen.getByDisplayValue("Plush Aesthetics")).toBeTruthy()
  })

  it("imports what was ticked, not what was visible", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(screen.getByPlaceholderText(/search 3 sub-accounts/i), "aura")
    await user.click(screen.getByRole("button", { name: /import 1 sub-account/i }))

    expect(onImport).toHaveBeenCalledTimes(1)
    expect(onImport.mock.calls[0][0].map((a) => a.location_id)).toEqual(["loc_2"])
  })
})

describe("sub-accounts review ordering", () => {
  // The editable Birdy-name fields, in the order the table renders them. The
  // search box is the only other text input and it is empty until typed into,
  // so a "has any value at all" match picks out the rows and nothing else.
  const rowNames = () => screen.getAllByDisplayValue(/./).map((el) => el.value)

  // The checkbox is a click-handling span, not an <input>, so it is reached
  // through the row rather than by role.
  const tickBoxFor = (name) =>
    screen.getByDisplayValue(name).parentElement.querySelector("span")

  it("puts the pre-selected sub-accounts on top and sorts the rest alphabetically", () => {
    renderStep()
    // Plush is the only one pre-selected (a lead in the last 7 days). Aura and
    // Lucy follow it in alphabetical order — not the order the fixture lists
    // them in, which is what the table used to show.
    expect(rowNames()).toEqual(["Plush Aesthetics", "Aura", "Lucy Jones PMU"])
  })

  it("drops an unticked sub-account back into the alphabetical pile", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.click(tickBoxFor("Plush Aesthetics"))

    expect(rowNames()).toEqual(["Aura", "Lucy Jones PMU", "Plush Aesthetics"])
  })

  it("floats a newly ticked sub-account up into the selection", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.click(tickBoxFor("Lucy Jones PMU"))

    // Both ticked rows lead, alphabetically between themselves; Aura is left
    // behind in the pile.
    expect(rowNames()).toEqual(["Lucy Jones PMU", "Plush Aesthetics", "Aura"])
  })
})
