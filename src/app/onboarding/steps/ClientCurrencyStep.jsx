import getSymbolFromCurrency from "currency-symbol-map"
import { STORAGE_KEYS } from "@/lib/constants"
import { PrimaryButton, STEP_COL, StepHeading } from "../parts"
import { CURRENCY_OPTIONS } from "../wizard"

export default function ClientCurrencyStep({
  clientDisplayName,
  selectedAd,
  currency,
  setCurrency,
  startFirstClientCreation,
  next,
}) {
  return (
    <div className={STEP_COL}>
      <div className="mb-2">
        <StepHeading small>What currency does {clientDisplayName} report in?</StepHeading>
      </div>
      <div className="mb-[26px] text-[13.5px] leading-normal text-pd-body">
        Every spend, cost and revenue figure for this client is shown in this currency.
        {selectedAd?.currency
          ? ` We've pre-filled it from their Meta ad account.`
          : ""}
      </div>
      <select
        value={currency || selectedAd?.currency || "GBP"}
        onChange={(e) => setCurrency(e.target.value)}
        className="mb-[30px] w-full rounded-full border-[1.5px] border-pd-border bg-white px-[14px] py-[13px] text-[15px] text-pd-ink outline-none transition-colors focus:border-pd-primary"
      >
        {CURRENCY_OPTIONS.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.label} ({getSymbolFromCurrency(c.code) || c.code})
          </option>
        ))}
      </select>
      <PrimaryButton
        onClick={() => {
          const chosen = currency || selectedAd?.currency || "GBP"
          setCurrency(chosen)
          // Also the account-wide default. The sign-up form used to ask
          // for this; now this step is the only place it gets set, and
          // useCurrency reads the localStorage copy synchronously on
          // first render, so writing it here stops the rest of the app
          // rendering "$" for a user who just said GBP.
          try {
            localStorage.setItem(STORAGE_KEYS.DEFAULT_CURRENCY, chosen)
          } catch { /* private mode — the server copy still wins on next login */ }
          startFirstClientCreation(chosen)
          next({ currency: chosen })
        }}
      >
        Continue
      </PrimaryButton>
    </div>
  )
}
