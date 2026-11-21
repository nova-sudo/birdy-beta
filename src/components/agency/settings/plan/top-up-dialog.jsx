"use client";

// Top up: pick a pack of credits; the pack then opens Whop's checkout.

import { Zap } from "lucide-react";
import { Dialog, DialogBody, DialogContent, EmptyState, Skeleton, cn } from "@/components/by";
import { FOCUS_RING } from "@/components/by/motion";

export function TopUpDialog({ open, onOpenChange, packs, loading, onPick }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Top up credits" description="Packs add to your balance. Secure checkout powered by Whop." className="max-w-md">
        <DialogBody className="flex flex-col gap-2">
          {loading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-by-md" />)
          ) : packs.length === 0 ? (
            <EmptyState icon={<Zap />} title="No packs to buy yet">Top-up packs aren’t on sale right now.</EmptyState>
          ) : (
            packs.map((pack) => {
              const ready = !!pack.plan_id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  disabled={!ready}
                  onClick={() => onPick(pack)}
                  className={cn(
                    "group flex cursor-pointer items-center gap-3 rounded-by-md border border-by-line px-3.5 py-2.5 text-left transition-colors duration-(--by-dur-fast) ease-by-out hover:border-by-accent hover:bg-by-accent-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-by-line disabled:hover:bg-transparent",
                    FOCUS_RING,
                  )}
                >
                  <span aria-hidden="true" className="grid size-7 place-items-center rounded-by-sm bg-by-accent-soft text-by-accent [&_svg]:size-3.5"><Zap /></span>
                  <span className="flex-1 font-semibold tabular-nums">{pack.credits.toLocaleString("en-GB")} credits</span>
                  <span className="font-semibold text-by-text-2 tabular-nums">{ready ? `$${pack.price}` : "Soon"}</span>
                </button>
              );
            })
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
