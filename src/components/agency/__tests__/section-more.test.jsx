import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { SectionMore } from "../section-more"
import { BUYER_SECTION, COACH_SECTION, OPS_SECTION } from "../sections"

const route = { search: "" }
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(route.search) }))

describe("the More menu", () => {
  it("lists Media Buyer's Reports, Projections and Context, keeping the client the page is narrowed to", async () => {
    route.search = "client=g0&range=last_14d"
    render(<SectionMore section={BUYER_SECTION} tab="birdseye" />)
    const more = screen.getByRole("button", { name: "More" })
    expect(more).not.toHaveAttribute("data-pill-current")
    await userEvent.click(more)
    const items = screen.getAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Reports", "Projections", "Context"])
    expect(items[0]).toHaveAttribute("href", "/media-buyer/reports?client=g0&range=last_14d")
    expect(items[1]).toHaveAttribute("href", "/media-buyer/projections?client=g0&range=last_14d")
    expect(items[2]).toHaveAttribute("href", "/media-buyer/context?client=g0&range=last_14d")
  })

  it("lists only the pages a section has something real for", async () => {
    route.search = ""
    const { unmount } = render(<SectionMore section={OPS_SECTION} tab="birdseye" />)
    await userEvent.click(screen.getByRole("button", { name: "More" }))
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Reports", "Context"])
    unmount()
    render(<SectionMore section={COACH_SECTION} tab="birdseye" />)
    await userEvent.click(screen.getByRole("button", { name: "More" }))
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Context"])
  })

  it("wears the open page's name and the chip while one of its pages is open", async () => {
    route.search = ""
    render(<SectionMore section={OPS_SECTION} tab="context" />)
    const more = screen.getByRole("button", { name: "Context" })
    expect(more).toHaveAttribute("data-pill-current")
    expect(more).toHaveAttribute("aria-current", "page")
    await userEvent.click(more)
    expect(screen.getByRole("menuitem", { name: "Context" })).toHaveAttribute("href", "/dashboard/context")
  })
})
