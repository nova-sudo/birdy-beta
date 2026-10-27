// Bulk import: a client whose Meta account another client already uses is
// imported without Meta, and the person is told where to link its campaigns.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
vi.mock("sonner", () => ({ toast }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))

const ACCOUNTS = [
  { location_id: "loc1", name: "Acme" },
  { location_id: "loc2", name: "Globex" },
]
vi.mock("@/app/onboarding/ReviewStep", () => ({
  default: ({ onImport }) => (
    <button type="button" onClick={() => onImport(ACCOUNTS)}>Import</button>
  ),
}))

const { default: BulkImportDialog } = await import("@/components/clients/BulkImportDialog")

const ok = (body = {}) => ({ ok: true, status: 200, json: async () => body })

beforeEach(() => {
  apiRequest.mockReset()
  Object.values(toast).forEach((f) => f.mockReset())
})

function setup(importBody) {
  apiRequest.mockImplementation(async (url) => {
    if (url === "/api/onboarding/import-subaccounts") return ok(importBody)
    if (url === "/api/onboarding/subaccounts-review") return ok({ prep: { status: "done" } })
    return ok({})
  })
  const onImported = vi.fn()
  render(<BulkImportDialog open onOpenChange={vi.fn()} onImported={onImported} />)
  return { user: userEvent.setup(), onImported }
}

describe("BulkImportDialog", () => {
  it("names the clients whose Meta account was already in use", async () => {
    const { user, onImported } = setup({
      imported: [
        { group_id: "g1", location_id: "loc1" },
        { group_id: "g2", location_id: "loc2", meta_skipped_reason: "shared_account" },
      ],
    })
    await user.click(screen.getByRole("button", { name: "Import" }))
    await waitFor(() => expect(onImported).toHaveBeenCalled())
    expect(toast.warning).toHaveBeenCalledWith(
      "Meta wasn't linked for Globex — that ad account is already used by another client. Re-add them from Add client to choose their campaigns."
    )
  })

  it("says nothing extra when every Meta account was linked", async () => {
    const { user, onImported } = setup({ imported: [{ group_id: "g1", location_id: "loc1" }] })
    await user.click(screen.getByRole("button", { name: "Import" }))
    await waitFor(() => expect(onImported).toHaveBeenCalled())
    expect(toast.warning).not.toHaveBeenCalled()
  })
})
