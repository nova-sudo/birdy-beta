import { STEP_COL, StepHeading, StepInput, WizardFooter } from "../parts"

export default function ClientConfirmStep({
  clientNameConfirm,
  setClientNameConfirm,
  selectedClient,
  selectedAd,
  firstGroupId,
  currency,
  next,
}) {
  return (
    <div className={STEP_COL}>
      <StepHeading description="Pulled from their GHL sub-account. Edit it if you'd like something different.">
        Want to change the client name?
      </StepHeading>
      <StepInput
        value={clientNameConfirm}
        onChange={(e) => setClientNameConfirm(e.target.value)}
        placeholder="Client name"
      />
      {/* Creation used to fire here and be awaited. It now happens on
          the next step (client_currency), because the currency is part
          of the payload and because nothing about naming a client
          needs a network round-trip. */}
      <WizardFooter
        primary={{
          label: "Confirm",
          disabled: !clientNameConfirm.trim() || !selectedClient,
          // $set on onboarding.data.first_client replaces the whole
          // field, so the draft has to be re-sent complete — including
          // a group_id if creation already succeeded and the user came
          // back to rename. Dropping it would strand the group.
          onClick: () => next({ first_client: {
            ...(firstGroupId ? { group_id: firstGroupId } : {}),
            ghl_location_id: selectedClient?.id,
            name: clientNameConfirm.trim(),
            meta_ad_account_id: selectedAd?.id || null,
            currency: currency || selectedAd?.currency || null,
          } }),
        }}
      />
    </div>
  )
}
