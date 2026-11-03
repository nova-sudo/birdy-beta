import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const hooks = { pages: {} }
vi.mock("@/lib/creatives-api", () => ({
  useCreativePages: (act) => ({ pages: hooks.pages[act] ?? [], isLoading: false, error: null }),
}))
const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))

import { AdPreview } from "../AdPreview"

const ACCOUNTS = [
  { ad_account_id: "act_1", page_id: "p1" },
  { ad_account_id: "act_2", page_id: "p2" },
]
const base = {
  format: "image",
  media: { blob_url: "blob:abc", mime: "image/png" },
  primary_text: "Short text",
  headline: "Check your options",
  cta_type: "LEARN_MORE",
  destination: "lead_form",
  website_url: "",
}

beforeEach(() => {
  apiRequest.mockReset()
  hooks.pages = {
    act_1: [{ id: "p1", name: "Harbour Finance" }],
    act_2: [{ id: "p2", name: "Keystone Homes" }],
  }
})

describe("AdPreview", () => {
  it("truncates text over 125 characters with a '…more' control", () => {
    const long = "a".repeat(200)
    render(<AdPreview creative={{ ...base, primary_text: long }} accounts={ACCOUNTS} />)
    expect(screen.getByText("…more")).toBeInTheDocument()
    expect(screen.queryByText(long)).not.toBeInTheDocument()
    expect(screen.getByTestId("preview-text").textContent).toContain("a".repeat(125))
  })

  it("shows short text whole, with no '…more'", () => {
    render(<AdPreview creative={base} accounts={ACCOUNTS} />)
    expect(screen.getByText("Short text")).toBeInTheDocument()
    expect(screen.queryByText("…more")).not.toBeInTheDocument()
  })

  it("shows FORM ON FACEBOOK for lead forms, and the domain for a website", () => {
    const { rerender } = render(<AdPreview creative={base} accounts={ACCOUNTS} />)
    expect(screen.getByText("FORM ON FACEBOOK")).toBeInTheDocument()
    rerender(<AdPreview creative={{ ...base, destination: "website", website_url: "https://www.harbour.co.uk/apply?x=1" }} accounts={ACCOUNTS} />)
    expect(screen.getByText("harbour.co.uk")).toBeInTheDocument()
    expect(screen.queryByText("FORM ON FACEBOOK")).not.toBeInTheDocument()
  })

  it("shows nothing for an invalid URL instead of crashing", () => {
    render(<AdPreview creative={{ ...base, destination: "website", website_url: "not a url" }} accounts={ACCOUNTS} />)
    expect(screen.getByText("Check your options")).toBeInTheDocument()
    expect(screen.queryByTestId("preview-caption")).toBeEmptyDOMElement()
  })

  it("maps CTA codes to labels, and WhatsApp to 'Send message'", () => {
    const { rerender } = render(<AdPreview creative={{ ...base, cta_type: "GET_QUOTE" }} accounts={ACCOUNTS} />)
    expect(screen.getByText("Get quote")).toBeInTheDocument()
    rerender(<AdPreview creative={{ ...base, destination: "whatsapp" }} accounts={ACCOUNTS} />)
    expect(screen.getByText("Send message")).toBeInTheDocument()
  })

  it("switching account changes the Page name", async () => {
    render(<AdPreview creative={base} accounts={ACCOUNTS} />)
    const name = () => screen.getByTestId("preview-page-name")
    expect(name()).toHaveTextContent("Harbour Finance")
    await userEvent.click(screen.getByRole("button", { name: "Keystone Homes" }))
    expect(name()).toHaveTextContent("Keystone Homes")
  })

  it("renders the revive source image when there is no local media", () => {
    render(<AdPreview creative={{ ...base, media: null }} source={{ image_url: "https://x/img.jpg" }} accounts={[]} />)
    expect(screen.getByRole("img", { name: "Ad media" })).toHaveAttribute("src", "https://x/img.jpg")
  })

  it("crops reels and stories to 9:16", async () => {
    render(<AdPreview creative={base} accounts={ACCOUNTS} />)
    expect(screen.getByTestId("preview-media").className).not.toMatch(/9\/16/)
    await userEvent.click(screen.getByRole("tab", { name: "Reels" }))
    expect(screen.getByTestId("preview-media").className).toMatch(/9\/16/)
  })

  it("after posting, 'View on Meta' fetches the preview and opens it", async () => {
    apiRequest.mockResolvedValue({ ok: true, json: async () => ({ preview_url: "https://meta/p" }) })
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    render(<AdPreview creative={base} accounts={ACCOUNTS} postedAds={[{ id: "a", ad_account_id: "act_1", account_name: "Harbour", meta: { ad_id: "123" } }]} />)
    await userEvent.click(screen.getByRole("button", { name: /View on Meta/ }))
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://meta/p", "_blank", "noopener,noreferrer"))
    expect(apiRequest).toHaveBeenCalledWith("/api/facebook/ad-preview/123")
    open.mockRestore()
  })
})
