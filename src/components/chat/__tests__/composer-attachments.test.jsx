// Attaching images and videos in the chat composer (creatives tracking, Task 30).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const toastError = vi.fn()
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: (...a) => toastError(...a), success: vi.fn() }),
  Toaster: () => null,
}))

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
vi.mock("@/hooks/useAiCredentials", () => ({
  useAiCredentials: () => ({ configured: true, refresh: vi.fn(), markUnconfigured: vi.fn() }),
}))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [] }) }))
vi.mock("@/lib/view-catalogues", () => ({ announceViewOps: vi.fn(), readViewCatalogues: () => [] }))

const uploadCreativeMedia = vi.fn()
vi.mock("@/lib/creative-upload", async (orig) => ({
  ...(await orig()),
  uploadCreativeMedia: (...a) => uploadCreativeMedia(...a),
}))

const { default: ChatConversation } = await import("@/components/chat/ChatConversation")

const png = (name) => new File(["x"], name, { type: "image/png" })
let n = 0
const okUpload = () =>
  uploadCreativeMedia.mockImplementation(async (file) => ({
    blob_url: `https://abc.public.blob.vercel-storage.com/creatives/${++n}-${file.name}`,
    mime: file.type,
    bytes: file.size,
    width: 10,
    height: 20,
    duration_s: null,
  }))

const fileInput = (container) => container.querySelector('input[type="file"]')
const lastBody = () => JSON.parse(apiRequest.mock.calls.at(-1)[1].body)

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  global.URL.createObjectURL = vi.fn(() => "blob:local")
  global.URL.revokeObjectURL = vi.fn()
  apiRequest.mockResolvedValue({ ok: true, status: 200, json: async () => ({ reply: "ok", tools_used: [], session_id: "s1" }) })
  okUpload()
  Element.prototype.scrollTo = vi.fn()
})

function setup() {
  return render(<ChatConversation sessionKey={`k${Math.random()}`} />)
}

describe("composer attachments", () => {
  it("refuses a fifth file with a toast", async () => {
    const { container } = setup()
    const files = ["a", "b", "c", "d", "e"].map((s) => png(`${s}.png`))
    await act(async () => {
      fireEvent.change(fileInput(container), { target: { files } })
    })
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/up to 4/i))
    expect(uploadCreativeMedia).toHaveBeenCalledTimes(4)
  })

  it("keeps send disabled while an upload is in flight", async () => {
    let release
    uploadCreativeMedia.mockImplementation(
      () => new Promise((r) => { release = () => r({ blob_url: "https://a.public.blob.vercel-storage.com/x", mime: "image/png", bytes: 1 }) }),
    )
    const user = userEvent.setup()
    const { container } = setup()
    await user.type(screen.getByRole("textbox"), "hello")
    expect(screen.getByLabelText("Send message")).toBeEnabled()
    await act(async () => {
      fireEvent.change(fileInput(container), { target: { files: [png("a.png")] } })
    })
    expect(screen.getByLabelText("Send message")).toBeDisabled()
    await act(async () => release())
    await waitFor(() => expect(screen.getByLabelText("Send message")).toBeEnabled())
  })

  it("sends the uploaded attachment in the request body", async () => {
    const user = userEvent.setup()
    const { container } = setup()
    await act(async () => {
      fireEvent.change(fileInput(container), { target: { files: [png("a.png")] } })
    })
    await user.type(screen.getByRole("textbox"), "look")
    await waitFor(() => expect(screen.getByLabelText("Send message")).toBeEnabled())
    await user.click(screen.getByLabelText("Send message"))
    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(lastBody().attachments).toEqual([
      { blob_url: expect.stringMatching(/^https:\/\/abc\.public\.blob\.vercel-storage\.com\//), mime: "image/png", bytes: 1, width: 10, height: 20 },
    ])
    // The bubble shows what was sent.
    expect(await screen.findByAltText("Attached image")).toBeInTheDocument()
  })

  it("drops a removed chip from the body", async () => {
    const user = userEvent.setup()
    const { container } = setup()
    await act(async () => {
      fireEvent.change(fileInput(container), { target: { files: [png("a.png"), png("b.png")] } })
    })
    await user.click(await screen.findByLabelText("Remove a.png"))
    await user.type(screen.getByRole("textbox"), "look")
    await user.click(screen.getByLabelText("Send message"))
    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    const atts = lastBody().attachments
    expect(atts).toHaveLength(1)
    expect(atts[0].blob_url).toContain("b.png")
  })

  it("toasts and removes the chip when an upload fails", async () => {
    uploadCreativeMedia.mockRejectedValue(new Error("Images must be 30 MB or smaller."))
    const { container } = setup()
    await act(async () => {
      fireEvent.change(fileInput(container), { target: { files: [png("big.png")] } })
    })
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Images must be 30 MB or smaller."))
    expect(screen.queryByLabelText("Remove big.png")).toBeNull()
  })

  it("text-only sends carry no attachments key", async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByRole("textbox"), "hi")
    await user.click(screen.getByLabelText("Send message"))
    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(lastBody()).not.toHaveProperty("attachments")
  })
})
