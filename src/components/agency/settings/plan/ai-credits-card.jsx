"use client";

// "AI credits": the balance against this period's allowance, the last 30
// days of use, and Top up. The balance is the shared credits status the rail's
// ring reads; usage and packs come from use-credit-usage.

import { Plus } from "lucide-react";
import { Button, Card, Disclosure, Pill, Skeleton } from "@/components/by";
import { useCredits } from "@/hooks/useCredits";
import { allowanceLeft, creditBreakdown } from "@/lib/plan-billing";
import { AllowanceRing, CardHeading } from "./plan-parts";

const n0 = (n) => Math.round(Number(n) || 0).toLocaleString("en-GB");

function UsageBars({ days }) {
  const max = Math.max(...days.map((d) => d.credits), 0);
  if (!max) return null;
  return (
    <div className="mt-3">
      <div role="img" aria-label={`Credits used each day, ${days.length} days`} className="flex h-16 items-end gap-0.5">
        {days.map((d) => (
          <span key={d.date} title={`${d.date} · ${n0(d.credits)} credits`} className="min-w-0 flex-1 rounded-t-[2px] bg-by-accent-line" style={{ height: `${Math.max(3, (d.credits / max) * 100)}%` }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-by-label text-by-muted tabular-nums">
        <span>{days[0].date.slice(5)}</span>
        <span>{days[days.length - 1].date.slice(5)}</span>
      </div>
    </div>
  );
}

export function AiCreditsCard({ usage, onTopUp }) {
  const { status, loading, balance, topupBalance, allowance, remainingAllowance, isOut, low, enforced } = useCredits();
  const data = usage.usage;
  const breakdown = creditBreakdown(data);

  if (loading && !status) {
    return (
      <Card padded className="flex flex-col gap-3 p-5">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-4"><Skeleton className="size-[92px] rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-7 w-24" /><Skeleton className="h-3 w-36" /></div></div>
      </Card>
    );
  }

  const pct = allowanceLeft(allowance, remainingAllowance);
  const tone = isOut ? "danger" : low ? "warning" : "accent";

  return (
    <Card padded className="flex flex-col p-5">
      <CardHeading
        title="AI credits"
        sub="About one cent of AI work each"
        aside={isOut ? <Pill tone="danger">Out of credits</Pill> : low ? <Pill tone="warning">Running low</Pill> : null}
      />
      <div className="mt-3 flex items-center gap-4.5">
        {pct != null && <AllowanceRing percent={pct} tone={tone} />}
        <div className="min-w-0">
          <div className={`font-by-display text-by-display font-bold tracking-[-0.02em] tabular-nums ${isOut ? "text-by-danger" : ""}`}>{n0(balance)}</div>
          <p className="text-by-body text-by-text-2">
            credits left{topupBalance > 0 && <> · includes {n0(topupBalance)} top-up</>}
          </p>
          {data && (
            <p className="mt-0.5 text-by-caption text-by-muted tabular-nums">
              {n0(data.total_credits)} used in 30 days · {n0(data.total_questions)} {data.total_questions === 1 ? "question" : "questions"} asked
            </p>
          )}
          {!enforced && status && <p className="mt-0.5 text-by-caption text-by-muted">Metering is live; usage isn’t blocked yet.</p>}
          <Button kind="soft" size="sm" className="mt-2.5" onClick={onTopUp}><Plus aria-hidden="true" />Top up</Button>
        </div>
      </div>

      <Disclosure label="Where credits went" count="30 days" className="mt-4">
        {!usage.usageLoaded ? (
          <Skeleton className="h-16 w-full rounded-by-md" />
        ) : !data || (breakdown.length === 0 && !(data.by_day ?? []).length) ? (
          <p className="text-by-body-sm text-by-muted">No AI use in the last 30 days.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {breakdown.map((r) => (
                <li key={r.key} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-by-body-sm">
                  <span className="truncate">{r.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-by-sunken"><i className="block h-full rounded-full bg-by-accent" style={{ width: `${r.share}%` }} /></span>
                  <span className="text-right tabular-nums text-by-text-2">{n0(r.credits)}</span>
                </li>
              ))}
            </ul>
            <UsageBars days={data.by_day ?? []} />
          </>
        )}
      </Disclosure>
    </Card>
  );
}
