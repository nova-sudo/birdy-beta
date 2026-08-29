// The Client Detail history book and its composer.
//
// The card mixes two sources: activity Birdy generated, and notes a person
// wrote. These cover the composer's contract with the page — it reports
// success or failure and the card reacts, rather than optimistically clearing
// an input whose note never saved.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { HistoryBook } = await import("@/components/clients/HistoryBook")

const note = (id, body, over = {}) => ({
  id,
  body,
  author: "Emma T.",
  created_at: new Date().toISOString(),
  ...over,
})

const activity = (id, title) => ({ id, title, client: "Aura", time: "2h ago" })

function setup(props = {}) {
  const onAddNote = props.onAddNote ?? vi.fn().mockResolvedValue(true)
  const onDeleteNote = props.onDeleteNote ?? vi.fn().mockResolvedValue(true)
  render(
    <HistoryBook
      clientName="Aura"
      notes={props.notes ?? []}
      activity={props.activity ?? []}
      loading={props.loading ?? false}
      onAddNote={onAddNote}
      onDeleteNote={onDeleteNote}
    />
  )
  return { user: userEvent.setup(), onAddNote, onDeleteNote }
}

const composer = () => screen.getByLabelText("Add a note")
const sendButton = () => screen.getByRole("button", { name: /save note/i })

beforeEach(() => vi.clearAllMocks())

describe("rendering", () => {
  it("shows notes and activity together", () => {
    setup({
      notes: [note("n1", "Client paused for a refit")],
      activity: [activity("a1", "Spend alert triggered")],
    })
    expect(screen.getByText("Client paused for a refit")).toBeInTheDocument()
    expect(screen.getByText("Spend alert triggered")).toBeInTheDocument()
  })

  it("invites the first note when there is nothing at all", () => {
    setup()
    expect(screen.getByText(/add the first note below/i)).toBeInTheDocument()
  })

  it("still offers the composer while empty", () => {
    setup()
    expect(composer()).toBeInTheDocument()
  })

  it("names the client in the placeholder", () => {
    setup()
    expect(screen.getByPlaceholderText(/add a note about aura/i)).toBeInTheDocument()
  })

  it("attributes each note to its author", () => {
    setup({ notes: [note("n1", "A note")] })
    expect(screen.getByText(/Emma T\./)).toBeInTheDocument()
  })
})

describe("writing a note", () => {
  it("sends the trimmed body", async () => {
    const { user, onAddNote } = setup()
    await user.type(composer(), "  Client moved budget  ")
    await user.click(sendButton())

    await waitFor(() => expect(onAddNote).toHaveBeenCalledWith("Client moved budget"))
  })

  it("submits on Enter", async () => {
    const { user, onAddNote } = setup()
    await user.type(composer(), "Quick note{Enter}")
    await waitFor(() => expect(onAddNote).toHaveBeenCalledWith("Quick note"))
  })

  it("clears the field once saved", async () => {
    const { user } = setup()
    await user.type(composer(), "Saved fine")
    await user.click(sendButton())

    await waitFor(() => expect(composer()).toHaveValue(""))
  })

  it("keeps the text when saving fails", async () => {
    // Clearing regardless would lose what the user typed with no way back.
    const onAddNote = vi.fn().mockResolvedValue(false)
    const { user } = setup({ onAddNote })

    await user.type(composer(), "Did not save")
    await user.click(sendButton())

    await waitFor(() => expect(onAddNote).toHaveBeenCalled())
    expect(composer()).toHaveValue("Did not save")
  })

  it("tells the user when saving fails", async () => {
    const { toast } = await import("sonner")
    const { user } = setup({ onAddNote: vi.fn().mockResolvedValue(false) })

    await user.type(composer(), "Did not save")
    await user.click(sendButton())

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it("will not send an empty or whitespace-only note", async () => {
    const { user, onAddNote } = setup()
    expect(sendButton()).toBeDisabled()

    await user.type(composer(), "   ")
    await user.click(sendButton())

    expect(onAddNote).not.toHaveBeenCalled()
  })

  it("disables the composer while in flight", async () => {
    let release
    const onAddNote = vi.fn(() => new Promise((r) => { release = r }))
    const { user } = setup({ onAddNote })

    await user.type(composer(), "Slow one")
    await user.click(sendButton())

    await waitFor(() => expect(composer()).toBeDisabled())
    release(true)
    await waitFor(() => expect(composer()).not.toBeDisabled())
  })
})

describe("deleting a note", () => {
  it("asks the page to delete by id", async () => {
    const { user, onDeleteNote } = setup({ notes: [note("n1", "Delete me")] })

    await user.click(screen.getByRole("button", { name: /delete note by emma t\./i }))

    await waitFor(() => expect(onDeleteNote).toHaveBeenCalledWith("n1"))
  })

  it("reports a failed delete", async () => {
    const { toast } = await import("sonner")
    const { user } = setup({
      notes: [note("n1", "Stubborn")],
      onDeleteNote: vi.fn().mockResolvedValue(false),
    })

    await user.click(screen.getByRole("button", { name: /delete note by emma t\./i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })
})

describe("loading", () => {
  it("shows placeholders rather than the empty state", () => {
    // "Nothing recorded yet" while still fetching would be a lie.
    setup({ loading: true })
    expect(screen.queryByText(/add the first note below/i)).not.toBeInTheDocument()
  })
})
