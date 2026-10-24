import { Notice } from "@/components/ds"
import {
  FakeProgressBar,
  InitialsAvatar,
  PickList,
  SearchInput,
  STEP_COL_WIDE,
  StepHeading,
  WizardFooter,
} from "../parts"

export default function ClientPickerStep({
  ghlStatus,
  locations,
  locationsError,
  clientSearch,
  setClientSearch,
  selectedClient,
  setSelectedClient,
  setClientNameConfirm,
  persistState,
  next,
}) {
  const clientQuery = clientSearch.toLowerCase()
  const clientItems = (locations || [])
    .filter((l) => (l.name || "").toLowerCase().includes(clientQuery))
    .map((l) => {
      // GHL's location shape varies by which upstream endpoint answered
      // (see fetch_locations in integrations/gohighlevel.py) — some only
      // carry `locationId`, not `id`/`_id`. Missing this fallback left every
      // row's id `undefined`, so every row compared equal to the (also
      // undefined) unselected state and all looked selected at once.
      const id = l.id || l._id || l.locationId
      return {
        id,
        title: l.name || "Unknown",
        sub: [l.city, l.state].filter(Boolean).join(", ") || l.address || "GHL sub-account",
        leading: <InitialsAvatar name={l.name} />,
        raw: { id, name: l.name },
      }
    })

  return (
    <div className={STEP_COL_WIDE}>
      <StepHeading>Let&apos;s choose your first client to onboard!</StepHeading>
      {ghlStatus === "checking" ? (
        <div className="py-10"><FakeProgressBar expectedMs={2500} caption="Checking your GHL connection…" /></div>
      ) : ghlStatus !== "success" ? (
        <div className="py-6 text-sm text-muted-foreground">
          Connect GHL first and your sub-accounts will show up here.
        </div>
      ) : locationsError ? (
        <Notice tone="danger" className="mb-4">{locationsError}</Notice>
      ) : locations === null ? (
        // A large agency's location list is genuinely slow — hundreds
        // of sub-accounts, paged out of GHL. A bare spinner here reads
        // as "hung" and people reload mid-fetch.
        <div className="py-10">
          <FakeProgressBar expectedMs={9000} caption="Fetching your GHL sub-accounts…" />
        </div>
      ) : (
        <>
          <SearchInput
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder={`Search ${locations.length} sub-account${locations.length === 1 ? "" : "s"}…`}
          />
          <PickList
            items={clientItems}
            selectedId={selectedClient?.id}
            onPick={(item) => {
              setSelectedClient(item.raw)
              setClientNameConfirm(item.raw.name || "")
              // connect_meta (the very next step) does a full OAuth
              // redirect away and back, which wipes any React state
              // that isn't persisted — save the pick immediately so
              // it survives that round-trip (restored in boot() via
              // data.first_client).
              persistState({ data: { first_client: {
                ghl_location_id: item.raw.id,
                name: item.raw.name,
              } } })
            }}
            emptyText="No sub-accounts match that search"
          />
        </>
      )}
      <WizardFooter primary={{ label: "Continue", disabled: !selectedClient, onClick: () => next() }} />
    </div>
  )
}
