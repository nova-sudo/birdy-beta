import getSymbolFromCurrency from "currency-symbol-map"
import { STORAGE_KEYS } from "@/lib/constants"
import { OptionCard, OptionGrid, STEP_COL_WIDE, StepHeading, WizardFooter } from "../parts"
import { CURRENCY_OPTIONS } from "../wizard"

export default function ClientCurrencyStep({
  clientDisplayName,
  selectedAd,
  currency,
  setCurrency,
  startFirstClientCreation,
  next,
}) {
  const chosen = currency || selectedAd?.currency || "GBP"

  return (
    <div className={STEP_COL_WIDE}>
      <StepHeading
        description={
          "Every spend, cost and revenue figure for this client is shown in this currency." +
          (selectedAd?.currency ? ` We've pre-filled it from their Meta ad account.` : "")
        }
      >
        What currency does {clientDisplayName} report in?
      </StepHeading>
      <OptionGrid label="Currency" density="compact">
        {CURRENCY_OPTIONS.map((c) => {
          const symbol = getSymbolFromCurrency(c.code) || c.code
          return (
            <OptionCard
              key={c.code}
              icon={symbol}
              label={c.label}
              hint={c.code}
              density="compact"
              selected={chosen === c.code}
              onClick={() => setCurrency(c.code)}
            />
          )
        })}
      </OptionGrid>
      <WizardFooter
        primary={{
          label: "Continue",
          onClick: () => {
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
          },
        }}
      />
    </div>
  )
}
