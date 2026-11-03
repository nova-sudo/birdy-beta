import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react"

const replace = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(""),
}))

const createCreativeTest = vi.fn()
const updateCreativeTest = vi.fn()
const searchCreativeAds = vi.fn()
vi.mock("@/lib/creatives-api", () => ({
  createCreativeTest: (...a) => createCreativeTest(...a),
  updateCreativeTest: (...a) => updateCreativeTest(...a),
  searchCreativeAds: (...a) => searchCreativeAds(...a),
  useCreativeTest: () => ({ test: null, isLoading: false }),
}))

const uploadCreativeMedia = vi.fn()
vi.mock("@/lib/creative-upload", () => ({
  uploadCreativeMedia: (...a) => uploadCreativeMedia(...a),
}))

import { CreativeWizard } from "../CreativeWizard"
import { WizardSteps } from "@/components/agents/WizardSteps"

const ADS = [
  {
    ad_id: "a1",
    name: "Mortgage myth #3",
    ad_account_id: "act_1",
    currency: "GBP",
    client_name: "Harbour Finance",
    status: "ACTIVE",
    thumbnail: "https://fbcdn/t.jpg",
    image: "https://fbcdn/i.jpg",
    video_id: null,
    title: "Check your options",
    body: "Most people think you need 20%.",
    metrics: { spend: 212, leads: 11, cpl: 19.27 },
  },
  {
    ad_id: "a2",
    name: "Video ad",
    ad_account_id: "act_2",
    client_name: "Keystone",
    status: "PAUSED",
    thumbnail: "https://fbcdn/t2.jpg",
    image: null,
    video_id: "v99",
    title: "Watch this",
    body: "Body two",
    metrics: { spend: 100, leads: 0, cpl: null },
  },
]

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  createCreativeTest.mockReset().mockResolvedValue({ id: "t1", code: "CT-0048", slug: "untitled" })
  updateCreativeTest.mockReset().mockResolvedValue({ id: "t1" })
  searchCreativeAds.mockReset().mockResolvedValue(ADS)
  uploadCreativeMedia.mockReset()
  replace.mockClear()
  window.history.replaceState(null, "", "/campaigns/creatives/new")
})
afterEach(() => vi.useRealTimers())

const settle = () => act(() => vi.advanceTimersByTimeAsync(900))
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const cont = () => screen.getByRole("button", { name: /continue/i })

async function pickRevive() {
  fireEvent.click(screen.getByRole("button", { name: /test an ad you already have/i }))
  await act(() => vi.advanceTimersByTimeAsync(400))
  fireEvent.click(await screen.findByRole("button", { name: /Mortgage myth #3/ }))
  await settle()
}

describe("WizardSteps", () => {
  it("renders custom steps and keeps the default labels", () => {
    const { rerender } = render(<WizardSteps current={1} steps={["A", "B"]} />)
    expect(screen.getByText("A")).toBeInTheDocument()
    rerender(<WizardSteps current={1} />)
    expect(screen.getByText("Scope & safety")).toBeInTheDocument()
  })
})

describe("CreativeWizard step 1", () => {
  it("shows the four creative steps", () => {
    render(<CreativeWizard testId={null} />)
    for (const s of ["Creative", "Accounts", "Targets", "Review & post"]) {
      expect(screen.getAllByText(s).length).toBeGreaterThan(0)
    }
  })

  it("keeps Continue disabled until media, text and destination are set", async () => {
    uploadCreativeMedia.mockResolvedValue({ blob_url: "https://blob/x.png", mime: "image/png", bytes: 1000, width: 10, height: 10, duration_s: null })
    render(<CreativeWizard testId={null} />)
    expect(cont()).toBeDisabled()
    type(/primary text/i, "Hello")
    expect(cont()).toBeDisabled()
    const file = new File(["x"], "x.png", { type: "image/png" })
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/^media/i), { target: { files: [file] } })
    })
    await waitFor(() => expect(cont()).toBeEnabled())
    fireEvent.click(screen.getByRole("tab", { name: /website/i }))
    expect(cont()).toBeDisabled()
    type(/website url/i, "https://example.com")
    expect(cont()).toBeEnabled()
    await settle()
  })

  it("sets creative.media and format from the upload", async () => {
    uploadCreativeMedia.mockResolvedValue({ blob_url: "https://blob/v.mp4", mime: "video/mp4", bytes: 5, width: 1080, height: 1920, duration_s: 27 })
    render(<CreativeWizard testId={null} />)
    const file = new File(["x"], "v.mp4", { type: "video/mp4" })
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/^media/i), { target: { files: [file] } })
    })
    await settle()
    const body = createCreativeTest.mock.calls[0][0]
    expect(body.creative.format).toBe("video")
    expect(body.creative.media.blob_url).toBe("https://blob/v.mp4")
  })

  it("picking a revive ad fills primary text, headline and source", async () => {
    render(<CreativeWizard testId={null} />)
    await pickRevive()
    expect(screen.getByLabelText(/primary text/i)).toHaveValue("Most people think you need 20%.")
    expect(screen.getByLabelText(/headline/i)).toHaveValue("Check your options")
    expect(cont()).toBeEnabled()
    const body = createCreativeTest.mock.calls[0][0]
    expect(body.origin).toBe("revive")
    expect(body.source).toMatchObject({ ad_id: "a1", ad_account_id: "act_1", image_url: "https://fbcdn/i.jpg" })
    expect(body.creative.media).toEqual({ image_url: "https://fbcdn/i.jpg" })
    expect(body.creative.edited).toBeFalsy()
  })

  it("flags edited after changing a copied field on a revive", async () => {
    render(<CreativeWizard testId={null} />)
    await pickRevive()
    type(/headline/i, "New headline")
    await settle()
    expect(updateCreativeTest).toHaveBeenCalledTimes(1)
    expect(updateCreativeTest.mock.calls[0][1].creative).toMatchObject({ headline: "New headline", edited: true })
  })

  it("notes that a revived video needs a file for other accounts", async () => {
    searchCreativeAds.mockResolvedValue([ADS[1]])
    render(<CreativeWizard testId={null} />)
    fireEvent.click(screen.getByRole("button", { name: /test an ad you already have/i }))
    await act(() => vi.advanceTimersByTimeAsync(400))
    fireEvent.click(await screen.findByRole("button", { name: /Video ad/ }))
    expect(screen.getByText(/To post this video to other ad accounts, upload the file/)).toBeInTheDocument()
    await settle()
    expect(createCreativeTest.mock.calls[0][0].creative.media).toEqual({ video_id: "v99", thumbnail_url: "https://fbcdn/t2.jpg" })
  })

  it("the slug input cannot change the code prefix", async () => {
    render(<CreativeWizard testId={null} />)
    type(/internal name/i, "Mortgage myth")
    await settle()
    expect(screen.getByText("CT-0048 |")).toBeInTheDocument()
    const slug = screen.getByLabelText(/ad name slug/i)
    expect(slug).toHaveValue("mortgage-myth")
    fireEvent.change(slug, { target: { value: "CT-9999 | Hello World" } })
    expect(slug).toHaveValue("ct-9999-hello-world")
    expect(screen.getByText("CT-0048 |")).toBeInTheDocument()
  })

  it("creates the draft once, then patches changed values only", async () => {
    render(<CreativeWizard testId={null} />)
    type(/primary text/i, "One")
    await settle()
    expect(createCreativeTest).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).toBe("/campaigns/creatives/t1/edit")
    type(/primary text/i, "One two")
    type(/headline/i, "H")
    await settle()
    expect(createCreativeTest).toHaveBeenCalledTimes(1)
    expect(updateCreativeTest).toHaveBeenCalledTimes(1)
    expect(updateCreativeTest.mock.calls[0][0]).toBe("t1")
    // Setting a value back to what was saved sends nothing.
    type(/headline/i, "H2")
    type(/headline/i, "H")
    await settle()
    expect(updateCreativeTest).toHaveBeenCalledTimes(1)
  })

  it("flushes a pending save before moving to the next step", async () => {
    uploadCreativeMedia.mockResolvedValue({ blob_url: "https://blob/x.png", mime: "image/png", bytes: 1, width: 1, height: 1, duration_s: null })
    render(<CreativeWizard testId={null} />)
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/^media/i), { target: { files: [new File(["x"], "x.png", { type: "image/png" })] } })
    })
    type(/primary text/i, "Text")
    await settle()
    type(/primary text/i, "Text changed")
    await act(async () => {
      fireEvent.click(cont())
    })
    // One save from the debounce, one flushed by Continue (no 800 ms wait).
    expect(updateCreativeTest).toHaveBeenCalledTimes(2)
    expect(updateCreativeTest.mock.calls[1][1].creative.primary_text).toBe("Text changed")
    expect(within(screen.getByTestId("wizard-step")).getByText(/accounts/i)).toBeInTheDocument()
  })

  it("patches source and origin when the pick comes after other edits", async () => {
    render(<CreativeWizard testId={null} />)
    type(/primary text/i, "Typed first")
    await settle()
    expect(createCreativeTest.mock.calls[0][0].origin).toBe("new")
    fireEvent.click(screen.getByRole("button", { name: /test an ad you already have/i }))
    await settle()
    fireEvent.click(await screen.findByRole("button", { name: /Mortgage myth #3/ }))
    await settle()
    const sent = updateCreativeTest.mock.calls.map((c) => c[1])
    const last = Object.assign({}, ...sent)
    expect(last.origin).toBe("revive")
    expect(last.source).toMatchObject({ ad_id: "a1", ad_account_id: "act_1", name: "Mortgage myth #3" })
    expect(createCreativeTest).toHaveBeenCalledTimes(1)
  })

  it("lets you change the source ad after picking one", async () => {
    render(<CreativeWizard testId={null} />)
    await pickRevive()
    fireEvent.click(screen.getByRole("button", { name: /^change ad$/i }))
    await settle()
    fireEvent.click(await screen.findByRole("button", { name: /Video ad/ }))
    await settle()
    const sent = Object.assign({}, ...updateCreativeTest.mock.calls.map((c) => c[1]))
    expect(sent.source).toMatchObject({ ad_id: "a2", video_id: "v99" })
    expect(sent.creative.media).toEqual({ video_id: "v99", thumbnail_url: "https://fbcdn/t2.jpg" })
  })

  it("shows picker money in the account currency", async () => {
    render(<CreativeWizard testId={null} />)
    fireEvent.click(screen.getByRole("button", { name: /test an ad you already have/i }))
    await settle()
    expect(await screen.findByText(/£212/)).toBeInTheDocument()
  })

  it("does not advance when the save failed", async () => {
    uploadCreativeMedia.mockResolvedValue({ blob_url: "https://blob/x.png", mime: "image/png", bytes: 1, width: 1, height: 1, duration_s: null })
    createCreativeTest.mockRejectedValue(new Error("down"))
    render(<CreativeWizard testId={null} />)
    type(/primary text/i, "Text")
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/^media/i), { target: { files: [new File(["x"], "x.png", { type: "image/png" })] } })
    })
    await waitFor(() => expect(cont()).toBeEnabled())
    await act(async () => {
      fireEvent.click(cont())
    })
    expect(screen.queryByText(/accounts step/i)).not.toBeInTheDocument()
    expect(screen.getByText(/couldn't save/i)).toBeInTheDocument()
  })

  it("after a failed create, later edits wait for the debounce instead of creating per keystroke", async () => {
    createCreativeTest.mockRejectedValueOnce(new Error("down")).mockResolvedValue({ id: "t1", code: "CT-0048", slug: "x" })
    render(<CreativeWizard testId={null} />)
    type(/primary text/i, "a")
    await act(() => vi.advanceTimersByTimeAsync(50))
    type(/primary text/i, "ab")
    type(/primary text/i, "abc")
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(createCreativeTest).toHaveBeenCalledTimes(1)
    await settle()
    expect(createCreativeTest).toHaveBeenCalledTimes(2)
    expect(createCreativeTest.mock.calls[1][0].creative.primary_text).toBe("abc")
  })

  it("does not touch the URL when a create finishes after leaving the page", async () => {
    let resolve
    createCreativeTest.mockReturnValue(new Promise((r) => (resolve = r)))
    const { unmount } = render(<CreativeWizard testId={null} />)
    type(/primary text/i, "a")
    unmount()
    window.history.replaceState(null, "", "/campaigns")
    await act(async () => resolve({ id: "t1", code: "CT-0048", slug: "x" }))
    expect(window.location.pathname).toBe("/campaigns")
  })

  it("retries on Continue after a failed save and advances once it succeeds", async () => {
    uploadCreativeMedia.mockResolvedValue({ blob_url: "https://blob/x.png", mime: "image/png", bytes: 1, width: 1, height: 1, duration_s: null })
    createCreativeTest
      .mockRejectedValueOnce(new Error("down")) // the first change
      .mockRejectedValueOnce(new Error("down")) // the first Continue
      .mockResolvedValue({ id: "t1", code: "CT-0048", slug: "x" })
    render(<CreativeWizard testId={null} />)
    type(/primary text/i, "Text")
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/^media/i), { target: { files: [new File(["x"], "x.png", { type: "image/png" })] } })
    })
    await waitFor(() => expect(cont()).toBeEnabled())
    await act(async () => {
      fireEvent.click(cont())
    })
    expect(screen.queryByText(/accounts step/i)).not.toBeInTheDocument()
    const calls = createCreativeTest.mock.calls.length
    await act(async () => {
      fireEvent.click(cont())
    })
    expect(createCreativeTest.mock.calls.length).toBe(calls + 1)
    expect(screen.getByText(/accounts step/i)).toBeInTheDocument()
  })
})
