import { Notice } from "@/components/ds"
import {
  FacebookGlyph,
  FakeProgressBar,
  PickList,
  SearchInput,
  STEP_COL_WIDE,
  StepHeading,
  WizardFooter,
} from "../parts"

export default function MetaAdPickerStep({
  clientDisplayName,
  metaStatus,
  adAccounts,
  adError,
  adSearch,
  setAdSearch,
  selectedAd,
  setSelectedAd,
  selectedClient,
  clientNameConfirm,
  persistState,
  next,
}) {
  const adQuery = adSearch.toLowerCase()
  const adItems = (adAccounts || [])
    .filter((a) => (a.name || "").toLowerCase().includes(adQuery))
    .map((a) => ({
      id: a.id,
      title: a.name || a.id,
      sub: a.id,
      leading: (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-control bg-info-soft text-info-ink">
          <FacebookGlyph size={15} />
        </div>
      ),
      raw: a,
    }))

  return (
    <div className={STEP_COL_WIDE}>
      <StepHeading>Which Meta ad account is {clientDisplayName}?</StepHeading>
      {metaStatus === "checking" ? (
        <div className="py-10"><FakeProgressBar expectedMs={2500} caption="Checking your Meta connection…" /></div>
      ) : metaStatus !== "success" ? (
        <div className="py-6 text-sm text-muted-foreground">
          Connect Meta first and your ad accounts will show up here.
        </div>
      ) : adError ? (
        <Notice tone="danger" className="mb-4">{adError}</Notice>
      ) : adAccounts === null ? (
        <div className="py-10">
          <FakeProgressBar expectedMs={6000} caption="Fetching your Meta ad accounts…" />
        </div>
      ) : (
        <>
          <SearchInput
            value={adSearch}
            onChange={(e) => setAdSearch(e.target.value)}
            placeholder="Search ad accounts…"
          />
          <PickList
            items={adItems}
            selectedId={selectedAd?.id}
            onPick={(item) => {
              setSelectedAd(item.raw)
              // Same reasoning as client_picker's onPick — persist the
              // full draft (not just the ad account) since $set on
              // onboarding.data.first_client replaces the whole field
              // rather than merging into what client_picker saved.
              persistState({ data: { first_client: {
                ghl_location_id: selectedClient?.id,
                name: clientNameConfirm || selectedClient?.name,
                meta_ad_account_id: item.raw.id,
                currency: item.raw.currency || null,
              } } })
            }}
            emptyText="No ad accounts match that search"
          />
        </>
      )}
      <WizardFooter primary={{ label: "Continue", disabled: !selectedAd, onClick: () => next() }} />
    </div>
  )
}
