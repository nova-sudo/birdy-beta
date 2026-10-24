import { Button, ProgressBar, Spinner, Surface } from "@/components/ds"
import { FakeProgressBar } from "./parts"

// Same slot for all three: top-right, under the 64px top bar.
const BADGE = "absolute right-4 top-[76px] z-10 w-[228px] rounded-surface p-3 text-left shadow-floating"

export default function BackgroundBadge({
  creationState,
  creationError,
  clientDisplayName,
  startFirstClientCreation,
  showSyncBadge,
  syncGhlPct,
  syncMetaPct,
}) {
  return (
    <>
      {/* Background-work corner badge. Since client creation stopped
          blocking the wizard, this is the only place the user can see that
          it is happening — and the only place a failure surfaces before the
          completion step, so the error branch has to be actionable. */}
      {creationState === "error" ? (
        <Surface className={`${BADGE} bg-danger-soft text-danger-ink`}>
          <div className="mb-0.5 text-sm font-medium">Couldn&apos;t add {clientDisplayName}</div>
          <div className="mb-1 text-xs leading-normal">
            {creationError || "We'll ask you to retry before you finish."}
          </div>
          <Button variant="link" size="sm" onClick={startFirstClientCreation} className="h-auto px-0 text-xs text-danger-ink">
            Try again
          </Button>
        </Surface>
      ) : creationState === "creating" ? (
        <Surface className={BADGE}>
          <div className="mb-2 flex items-center gap-2">
            <Spinner />
            <span className="text-sm font-medium text-foreground">Adding {clientDisplayName}</span>
          </div>
          <FakeProgressBar expectedMs={18000} />
        </Surface>
      ) : showSyncBadge ? (
        <Surface className={BADGE}>
          <div className="mb-2 flex items-center gap-2">
            <Spinner />
            <span className="text-sm font-medium text-foreground">Syncing historical data</span>
          </div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>GHL</span><span className="num">{Math.round(syncGhlPct)}%</span>
          </div>
          <ProgressBar value={syncGhlPct} tone="primary" label="GHL sync" className="mb-2" />
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Meta</span><span className="num">{Math.round(syncMetaPct)}%</span>
          </div>
          <ProgressBar value={syncMetaPct} tone="primary" label="Meta sync" />
        </Surface>
      ) : null}
    </>
  )
}
