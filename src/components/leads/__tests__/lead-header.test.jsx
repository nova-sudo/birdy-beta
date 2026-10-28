import { describe, it, expect } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { COMPOSER_INPUT_ID, LeadHeader, dealValue } from "../LeadHeader"

const detail = {
  contact: { name: "Rebecca Becirspahic", phone: "07393 421825", group_name: "BBL Lanarkshire", date_added: "2026-07-17T09:00:00Z" },
  opportunities: [{ status: "open", stage_name: "Spicy Leads", monetary_value: 99 }],
  engagement: { touchpoints: 4, time_to_close_seconds: 9240 },
  attribution: { ad_name: "Body Sculpt voucher" },
}

describe("dealValue", () => {
  it("formats the first opportunity's value and dashes the rest", () => {
    expect(dealValue([{ monetary_value: 1250.5 }])).toBe("1,250.5")
    expect(dealValue([{ monetary_value: 0 }])).toBe("—")
    expect(dealValue([])).toBe("—")
  })
})

describe("LeadHeader", () => {
  it("shows identity, status and the figure strip", () => {
    render(<LeadHeader detail={detail} messageCount={7} />)
    expect(screen.getByRole("heading", { name: "Rebecca Becirspahic" })).toBeInTheDocument()
    expect(screen.getByText("Spicy Leads")).toBeInTheDocument()
    expect(screen.getByText("BBL Lanarkshire · Meta · Body Sculpt voucher")).toBeInTheDocument()
    expect(screen.getByText("99")).toBeInTheDocument()
    expect(screen.getByText("2h 34m")).toBeInTheDocument()
    expect(screen.getByText("11")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:07393 421825")
  })

  it("hides Call without a phone and focuses the composer on Message", () => {
    render(
      <>
        <LeadHeader detail={{ ...detail, contact: { name: "No Phone" } }} />
        <textarea id={COMPOSER_INPUT_ID} />
      </>
    )
    expect(screen.queryByRole("link", { name: "Call" })).toBeNull()
    Element.prototype.scrollIntoView ??= () => {}
    fireEvent.click(screen.getByRole("button", { name: "Message" }))
    expect(document.activeElement.id).toBe(COMPOSER_INPUT_ID)
  })
})
