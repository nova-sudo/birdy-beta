import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

let tabParam = "ai"
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(`tab=${tabParam}`),
  usePathname: () => "/settings",
}))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("@/components/page-header", () => ({ usePageHeader: () => {} }))
vi.mock("@/components/settings/GeneralSettings", () => ({ GeneralSettings: () => null }))
vi.mock("@/components/settings/CreditsPanel", () => ({ CreditsPanel: () => null }))
vi.mock("@/components/billing/PlanPicker", () => ({ PlanPicker: () => null }))
vi.mock("@/components/attribution/TrackingOverview", () => ({ default: () => null }))
vi.mock("@/components/settings/ConnectAI", () => ({ ConnectAI: () => null }))

import { apiRequest } from "@/lib/api"
import SettingsPage from "../page"

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(apiRequest).mockImplementation(() =>
    Promise.resolve({ ok: true, json: async () => ({}) })
  )
})
afterEach(() => {
  delete Element.prototype.scrollIntoView
})

describe("settings tab bar", () => {
  it("selected settings tab scrolled into view", async () => {
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy
    render(<SettingsPage />)
    const tab = await screen.findByRole("tab", { selected: true })
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(spy.mock.contexts.at(-1)).toBe(tab)
    expect(spy).toHaveBeenLastCalledWith({ inline: "nearest", block: "nearest" })

    spy.mockClear()
    await userEvent.click(screen.getByRole("tab", { name: /general/i }))
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(spy.mock.contexts.at(-1)).toHaveAttribute("aria-selected", "true")
  })

  it("does not crash where scrollIntoView is missing", async () => {
    expect(Element.prototype.scrollIntoView).toBeUndefined()
    render(<SettingsPage />)
    expect(await screen.findByRole("tab", { selected: true })).toBeInTheDocument()
  })

  it("tab bar scrolls sideways on mobile without wrapping", async () => {
    render(<SettingsPage />)
    const list = await screen.findByRole("tablist")
    expect(list.className).toContain("max-md:overflow-x-auto")
    expect(list.className).toContain("max-md:[scrollbar-width:none]")
    for (const t of screen.getAllByRole("tab")) {
      expect(t.className).toContain("shrink-0")
      expect(t.className).toContain("whitespace-nowrap")
    }
  })
})
