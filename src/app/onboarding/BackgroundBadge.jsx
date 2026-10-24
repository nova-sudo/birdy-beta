import { AlertCircle } from "lucide-react"
import { FakeProgressBar, ProgressBar, SpinnerRing } from "./parts"

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
        <div className="absolute right-4 top-[76px] z-10 w-[228px] rounded-xl border border-pd-danger-border bg-pd-danger-bg px-[13px] py-[10px] text-left shadow-[0_10px_24px_-10px_rgba(30,25,60,0.25)] sm:top-[88px]">
          <div className="mb-[2px] flex items-center gap-[7px]">
            <AlertCircle className="h-[13px] w-[13px] shrink-0 text-pd-danger" strokeWidth={2.4} />
            <span className="text-[11.5px] font-semibold text-pd-danger">
              Couldn&apos;t add {clientDisplayName}
            </span>
          </div>
          <div className="mb-[7px] text-[10.5px] leading-normal text-pd-body">
            {creationError || "We'll ask you to retry before you finish."}
          </div>
          <button
            type="button"
            onClick={startFirstClientCreation}
            className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-pd-primary underline"
          >
            Try again
          </button>
        </div>
      ) : creationState === "creating" ? (
        <div className="absolute right-4 top-[76px] z-10 w-[210px] rounded-xl border border-pd-border bg-white px-[13px] py-[10px] text-left shadow-[0_10px_24px_-10px_rgba(30,25,60,0.25)] sm:top-[88px]">
          <div className="mb-[7px] flex items-center gap-[9px]">
            <SpinnerRing />
            <span className="text-[11.5px] font-semibold text-pd-ink">Adding {clientDisplayName}</span>
          </div>
          <FakeProgressBar expectedMs={18000} />
        </div>
      ) : showSyncBadge ? (
        <div className="absolute right-4 top-[76px] z-10 w-[210px] rounded-xl border border-pd-border bg-white px-[13px] py-[10px] text-left shadow-[0_10px_24px_-10px_rgba(30,25,60,0.25)] sm:top-[88px]">
          <div className="mb-[8px] flex items-center gap-[9px]">
            <SpinnerRing />
            <span className="text-[11.5px] font-semibold text-pd-ink">Syncing historical data</span>
          </div>
          <div className="mb-[3px] flex items-center justify-between text-[10.5px] text-pd-faint">
            <span>GHL</span><span>{Math.round(syncGhlPct)}%</span>
          </div>
          <ProgressBar value={syncGhlPct} className="mb-[7px]" />
          <div className="mb-[3px] flex items-center justify-between text-[10.5px] text-pd-faint">
            <span>Meta</span><span>{Math.round(syncMetaPct)}%</span>
          </div>
          <ProgressBar value={syncMetaPct} />
        </div>
      ) : null}
    </>
  )
}
