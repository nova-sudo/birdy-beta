import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const routeParams = vi.hoisted(() => ({ contactId: "c1" }))
vi.mock("next/navigation", () => ({ useParams: () => routeParams }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("@/components/page-header", () => ({ usePageHeader: () => {} }))

import { apiRequest } from "@/lib/api"
import { LeadJourneyTab } from "../LeadJourneyTab"
import LeadDetailPage from "@/app/contacts/[contactId]/page"

const ev = (o) => ({ id: "e", kind: "lead", title: "T", detail: "D", at: new Date(2026, 6, 17, 16, 59).toISOString(), ...o })

describe("LeadJourneyTab", () => {
  it("renders events in the given order with chip, title and detail", () => {
    const events = [
      ev({ id: "1", kind: "conversion", title: "Meta lead form submitted", detail: "Meta Ads · Spring" }),
      ev({ id: "2", kind: "call", title: "Inbound answered · 2:05", detail: "Call" }),
      ev({ id: "3", kind: "visit", title: "Visited /pricing", detail: "From Direct" }),
    ]
    render(<LeadJourneyTab journey={{ events, ghl: "ok" }} />)
    expect(screen.getByText("Customer journey")).toBeInTheDocument()
    const titles = screen.getAllByText(/Meta lead form|Inbound answered|Visited/).map((n) => n.textContent)
    expect(titles).toEqual(["Meta lead form submitted", "Inbound answered · 2:05", "Visited /pricing"])
    expect(screen.getByText("CONVERSION")).toBeInTheDocument()
    expect(screen.getByText("CALL")).toBeInTheDocument()
    expect(screen.getByText("PAGE VIEW")).toBeInTheDocument()
    expect(screen.getByText("Meta Ads · Spring · 17 Jul, 4:59 PM")).toBeInTheDocument()
    // call title carries the duration already; nothing appended
    expect(screen.getByText("Inbound answered · 2:05")).toBeInTheDocument()
  })

  it("shows appointment start as 'for ...'", () => {
    const events = [ev({ kind: "appointment", title: "Appointment booked", detail: "Consult", starts_at: new Date(2026, 6, 20, 9, 30).toISOString() })]
    render(<LeadJourneyTab journey={{ events, ghl: "ok" }} />)
    expect(screen.getByText("APPOINTMENT")).toBeInTheDocument()
    expect(screen.getByText("Consult · for 20 Jul, 9:30 AM · booked 17 Jul, 4:59 PM")).toBeInTheDocument()
  })

  it("reads a zone-less starts_at as location clock time", () => {
    const events = [ev({ kind: "appointment", title: "Appointment booked", detail: "Consult", starts_at: "2026-07-20T09:30:00", starts_at_local: true })]
    render(<LeadJourneyTab journey={{ events, ghl: "ok" }} />)
    expect(screen.getByText("Consult · for 20 Jul, 9:30 AM · booked 17 Jul, 4:59 PM")).toBeInTheDocument()
  })

  it("omits 'for' when starts_at is missing", () => {
    const events = [ev({ kind: "appointment", title: "Appointment booked", detail: "Consult" })]
    render(<LeadJourneyTab journey={{ events, ghl: "ok" }} />)
    expect(screen.getByText("Consult · booked 17 Jul, 4:59 PM")).toBeInTheDocument()
  })

  it("loading, empty and error states", () => {
    const onRetry = vi.fn()
    const { rerender } = render(<LeadJourneyTab status="loading" />)
    expect(screen.getByText("Loading journey…")).toBeInTheDocument()
    rerender(<LeadJourneyTab journey={{ events: [], ghl: "ok" }} />)
    expect(screen.getByText("No journey events yet.")).toBeInTheDocument()
    rerender(<LeadJourneyTab status="error" onRetry={onRetry} />)
    expect(screen.getByText(/Couldn.t load the journey\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalled()
  })

  it("notes for reconnect and unavailable, none for ok", () => {
    const { rerender } = render(<LeadJourneyTab journey={{ events: [ev({})], ghl: "reconnect" }} />)
    expect(screen.getByText(/Reconnect GoHighLevel to include appointments and pipeline history\./)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings")
    rerender(<LeadJourneyTab journey={{ events: [ev({})], ghl: "unavailable" }} />)
    expect(screen.getByText(/Appointments and pipeline history couldn.t be loaded\./)).toBeInTheDocument()
    rerender(<LeadJourneyTab journey={{ events: [ev({})], ghl: "ok" }} />)
    expect(screen.queryByText(/pipeline history/)).toBeNull()
  })
})

describe("Journey fetch on the detail page", () => {
  const json = (body, ok = true, status = 200) => ({ ok, status, json: async () => body })
  let journeyCalls
  let journeyResponses

  beforeEach(() => {
    journeyCalls = 0
    journeyResponses = []
    apiRequest.mockReset()
    apiRequest.mockImplementation(async (url) => {
      if (url.endsWith("/journey")) {
        journeyCalls += 1
        return journeyResponses.shift()
      }
      if (url.endsWith("/messages")) return json({ messages: [], status: "ok" })
      return json({ contact: { name: "Ann" }, opportunities: [], calls: [], engagement: {}, attribution: {} })
    })
  })

  const openTab = async () => {
    render(<LeadDetailPage />)
    const tab = await screen.findByRole("tab", { name: "Journey" })
    fireEvent.click(tab)
    return tab
  }

  it("orders tabs Profile, Journey, Calls, Ads", async () => {
    render(<LeadDetailPage />)
    await screen.findByRole("tab", { name: "Journey" })
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Profile", "Journey", "Calls", "Ads"])
    expect(journeyCalls).toBe(0)
  })

  it("fetches once on first open and caches across tab switches", async () => {
    journeyResponses = [json({ events: [ev({ title: "Lead created" })], ghl: "ok" })]
    await openTab()
    expect(await screen.findByText("Lead created")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Calls" }))
    fireEvent.click(screen.getByRole("tab", { name: "Journey" }))
    expect(await screen.findByText("Lead created")).toBeInTheDocument()
    expect(journeyCalls).toBe(1)
  })

  it("drops a stale response from the previous lead", async () => {
    let resolveSlow
    journeyResponses = [new Promise((r) => { resolveSlow = r }), json({ events: [ev({ title: "Fresh" })], ghl: "ok" })]
    const { rerender } = render(<LeadDetailPage />)
    fireEvent.click(await screen.findByRole("tab", { name: "Journey" }))
    await waitFor(() => expect(journeyCalls).toBe(1))
    routeParams.contactId = "c2"
    rerender(<LeadDetailPage />)
    fireEvent.click(await screen.findByRole("tab", { name: "Journey" }))
    expect(await screen.findByText("Fresh")).toBeInTheDocument()
    resolveSlow(json({ events: [ev({ title: "Stale" })], ghl: "ok" }))
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.queryByText("Stale")).toBeNull()
    expect(screen.getByText("Fresh")).toBeInTheDocument()
    routeParams.contactId = "c1"
  })

  it("retries after a failure", async () => {
    journeyResponses = [json({}, false, 500), json({ events: [ev({ title: "Lead created" })], ghl: "ok" })]
    await openTab()
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Lead created")).toBeInTheDocument()
    await waitFor(() => expect(journeyCalls).toBe(2))
  })
})
