import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

const hooks = { accounts: [], adsets: {}, pages: {}, forms: {}, adsetErrors: {}, loading: {} }
vi.mock("@/lib/creatives-api", () => ({
  useCreativeAdAccounts: () => ({ accounts: hooks.accounts, isLoading: false, error: null }),
  useCreativeAdsets: (act) => ({
    adsets: hooks.adsets[act] ?? [],
    error: hooks.adsetErrors[act] ? new Error(hooks.adsetErrors[act]) : null,
    isLoading: !!hooks.loading[act],
  }),
  useCreativePages: (act) => ({ pages: hooks.pages[act] ?? [], isLoading: false, error: null }),
  useCreativeLeadForms: (pid) => ({ forms: hooks.forms[pid] ?? [], isLoading: false, error: null }),
}))

import { StepAccounts, accountsStepValid } from "../StepAccounts"

const ACCOUNTS = [
  { ad_account_id: "act_1", name: "Harbour Finance", currency: "GBP", clients: [{ id: "g1", name: "Harbour Finance" }] },
  { ad_account_id: "act_2", name: "Keystone, Oakline", currency: "USD", clients: [{ id: "g2", name: "Keystone" }, { id: "g3", name: "Oakline" }] },
  { ad_account_id: "act_3", name: "Birch", currency: "USD", clients: [{ id: "g4", name: "Birch" }] },
]
const adset = (id, name, extra = {}) => ({ id, name, compatible: true, reason: null, owning_client_group_id: "g1", ...extra })

beforeEach(() => {
  // Radix Select needs these in jsdom.
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
  hooks.accounts = ACCOUNTS
  hooks.adsets = {
    act_1: [adset("s1", "Birdy tests"), adset("s2", "Traffic", { compatible: false, reason: "lead form ads need a campaign with objective OUTCOME_LEADS (this one is OUTCOME_TRAFFIC)" })],
    act_2: [adset("s3", "Birdy tests", { owning_client_group_id: "g3" }), adset("s4", "Other")],
    act_3: [adset("s5", "Something else")],
  }
  hooks.pages = {
    act_1: [{ id: "p1", name: "Page One" }, { id: "p9", name: "Source Page" }],
    act_2: [{ id: "p2", name: "Page Two" }],
    act_3: [{ id: "p3", name: "Page Three" }],
  }
  hooks.forms = { p1: [{ id: "f1", name: "Form One" }], p9: [{ id: "f9", name: "Form Nine" }], p2: [{ id: "f2", name: "Form Two" }] }
  hooks.adsetErrors = {}
  hooks.loading = {}
})

const baseDraft = (over = {}) => ({ id: "t1", origin: "new", source: null, creative: { destination: "lead_form", media: { blob_url: "https://b/x" }, accounts: [], ...over.creative }, ...over.top })

function Harness({ initial, onChange, ...props }) {
  const [draft, setDraft] = useState(initial)
  const setField = (path, value) => {
    expect(path).toBe("creative.accounts")
    onChange?.(value)
    setDraft((d) => ({ ...d, creative: { ...d.creative, accounts: value } }))
  }
  return <StepAccounts draft={draft} setField={setField} {...props} />
}

const setup = (draft = baseDraft(), props = {}) => {
  const changes = []
  const user = userEvent.setup()
  render(<Harness initial={draft} onChange={(v) => changes.push(v)} {...props} />)
  return { user, last: () => changes[changes.length - 1] }
}

async function pick(user, label, option) {
  await user.click(screen.getByRole("combobox", { name: label }))
  await user.click(await screen.findByRole("option", { name: option }))
}

describe("StepAccounts", () => {
  it("lists each account once, labelled with every client name", () => {
    setup()
    expect(screen.getByText("Keystone, Oakline")).toBeInTheDocument()
    expect(screen.getAllByRole("checkbox", { name: /Select Keystone, Oakline/ })).toHaveLength(1)
  })

  it("disables an incompatible ad set and shows its reason", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("checkbox", { name: "Select Harbour Finance" }))
    await user.click(screen.getByRole("combobox", { name: "Ad set for Harbour Finance" }))
    const opt = await screen.findByRole("option", { name: /Traffic/ })
    expect(opt).toHaveAttribute("aria-disabled", "true")
    expect(within(opt).getByText(/need a campaign with objective OUTCOME_LEADS/)).toBeInTheDocument()
  })

  it("stores the ad set, its name and the owning group", async () => {
    const { user, last } = setup()
    await user.click(screen.getByRole("checkbox", { name: "Select Keystone, Oakline" }))
    await pick(user, "Ad set for Keystone, Oakline", "Birdy tests")
    expect(last()).toEqual([
      { ad_account_id: "act_2", client_group_id: "g3", adset_id: "s3", adset_name: "Birdy tests", page_id: "p2", lead_form_id: null },
    ])
  })

  it("Apply to all fills only same-named ad sets", async () => {
    const { user, last } = setup()
    for (const n of ["Harbour Finance", "Keystone, Oakline", "Birch"]) await user.click(screen.getByRole("checkbox", { name: `Select ${n}` }))
    await pick(user, "Ad set for Harbour Finance", "Birdy tests")
    await user.click(screen.getByRole("button", { name: "Apply ad set to all" }))
    const by = Object.fromEntries(last().map((a) => [a.ad_account_id, a]))
    expect(by.act_1.adset_id).toBe("s1")
    expect(by.act_2.adset_id).toBe("s3")
    expect(by.act_2.client_group_id).toBe("g3")
    expect(by.act_3.adset_id).toBeNull()
    expect(screen.getByText("No matching ad set in 1 account")).toBeInTheDocument()
  })

  it("disables Apply to all while another selected account's ad sets load", async () => {
    hooks.loading.act_3 = true
    const { user } = setup()
    for (const n of ["Harbour Finance", "Birch"]) await user.click(screen.getByRole("checkbox", { name: `Select ${n}` }))
    await pick(user, "Ad set for Harbour Finance", "Birdy tests")
    expect(screen.getByRole("button", { name: "Apply ad set to all" })).toBeDisabled()
    expect(screen.getByText(/Waiting for every ad set list/)).toBeInTheDocument()
  })

  it("clears an ad set that is no longer compatible and a lead form when the destination is not lead_form", () => {
    const rows = [{ ad_account_id: "act_1", client_group_id: "g1", adset_id: "s2", adset_name: "Traffic", page_id: "p1", lead_form_id: "f1" }]
    const { last } = setup(baseDraft({ creative: { destination: "website", accounts: rows } }))
    expect(last()).toEqual([{ ad_account_id: "act_1", client_group_id: null, adset_id: null, adset_name: null, page_id: "p1", lead_form_id: null }])
  })

  it("clears an ad set that no longer exists", () => {
    const rows = [{ ad_account_id: "act_1", client_group_id: "g1", adset_id: "gone", adset_name: "Gone", page_id: "p1", lead_form_id: "f1" }]
    const { last } = setup(baseDraft({ creative: { accounts: rows } }))
    expect(last()[0]).toMatchObject({ adset_id: null, adset_name: null, client_group_id: null, lead_form_id: "f1" })
  })

  it("keeps locked accounts out of the editable panels", () => {
    const rows = [{ ad_account_id: "act_3", client_group_id: null, adset_id: null, adset_name: null, page_id: null, lead_form_id: null }]
    setup(baseDraft({ creative: { accounts: rows } }), { lockedAccountIds: ["act_3"] })
    expect(screen.queryByRole("combobox", { name: "Ad set for Birch" })).not.toBeInTheDocument()
  })

  it("shows the lead form select only for the lead_form destination", async () => {
    const lead = setup()
    await lead.user.click(screen.getByRole("checkbox", { name: "Select Harbour Finance" }))
    expect(screen.getByRole("combobox", { name: "Lead form for Harbour Finance" })).toBeInTheDocument()
  })

  it("has no lead form select for a website destination", async () => {
    const { user } = setup(baseDraft({ creative: { destination: "website" } }))
    await user.click(screen.getByRole("checkbox", { name: "Select Harbour Finance" }))
    expect(screen.getByRole("combobox", { name: "Ad set for Harbour Finance" })).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: /Lead form for/ })).not.toBeInTheDocument()
  })

  it("defaults the Page to the revive source page, else the first promote page", async () => {
    const { user, last } = setup(baseDraft({ top: { origin: "revive", source: { ad_id: "a1", ad_account_id: "act_1", page_id: "p9" } } }))
    await user.click(screen.getByRole("checkbox", { name: "Select Harbour Finance" }))
    await user.click(screen.getByRole("checkbox", { name: "Select Keystone, Oakline" }))
    const by = Object.fromEntries(last().map((a) => [a.ad_account_id, a]))
    expect(by.act_1.page_id).toBe("p9")
    expect(by.act_2.page_id).toBe("p2")
  })

  it("keeps a revived video to its own account unless a file was uploaded", async () => {
    const draft = baseDraft({ creative: { media: { video_id: "v1" } }, top: { origin: "revive", source: { ad_id: "a1", ad_account_id: "act_1" } } })
    setup(draft)
    expect(screen.getByRole("checkbox", { name: "Select Harbour Finance" })).toBeEnabled()
    expect(screen.getByRole("checkbox", { name: "Select Birch" })).toBeDisabled()
    expect(screen.getAllByText("Upload the video file to post here")).toHaveLength(2)
  })

  it("allows other accounts for a revived video once a file exists", () => {
    setup(baseDraft({ creative: { media: { video_id: "v1", blob_url: "https://b/v.mp4" } }, top: { origin: "revive", source: { ad_id: "a1", ad_account_id: "act_1" } } }))
    expect(screen.getByRole("checkbox", { name: "Select Birch" })).toBeEnabled()
    expect(screen.queryByText("Upload the video file to post here")).not.toBeInTheDocument()
  })

  it("shows accounts already in the test as checked and locked", () => {
    setup(baseDraft(), { lockedAccountIds: ["act_3"] })
    const box = screen.getByRole("checkbox", { name: "Select Birch" })
    expect(box).toBeChecked()
    expect(box).toBeDisabled()
    expect(screen.getByText("Already posted")).toBeInTheDocument()
  })

  it("shows an ad set failure on that account only", async () => {
    hooks.adsetErrors.act_1 = "Meta is down"
    const { user } = setup()
    await user.click(screen.getByRole("checkbox", { name: "Select Harbour Finance" }))
    await user.click(screen.getByRole("checkbox", { name: "Select Birch" }))
    expect(screen.getByText(/Meta is down/)).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Ad set for Birch" })).toBeInTheDocument()
  })
})

describe("accountsStepValid", () => {
  const row = (o = {}) => ({ ad_account_id: "act_1", adset_id: "s1", page_id: "p1", lead_form_id: "f1", ...o })
  const d = (accounts, destination = "lead_form") => ({ creative: { destination, accounts } })

  it("needs at least one account", () => {
    expect(accountsStepValid(d([]))).toBe(false)
    expect(accountsStepValid(d(undefined))).toBe(false)
  })
  it("needs an ad set on every row", () => {
    expect(accountsStepValid(d([row(), row({ ad_account_id: "act_2", adset_id: null })]))).toBe(false)
    expect(accountsStepValid(d([row()]))).toBe(true)
  })
  it("ignores locked accounts and needs a new row in add-accounts mode", () => {
    expect(accountsStepValid(d([row()]), ["act_1"])).toBe(false)
    expect(accountsStepValid(d([row(), row({ ad_account_id: "act_2" })]), ["act_1"])).toBe(true)
    expect(accountsStepValid(d([row(), row({ ad_account_id: "act_2", adset_id: null })]), ["act_1"])).toBe(false)
  })
  it("needs a lead form only for lead_form", () => {
    expect(accountsStepValid(d([row({ lead_form_id: null })]))).toBe(false)
    expect(accountsStepValid(d([row({ lead_form_id: null })], "website"))).toBe(true)
  })
})
