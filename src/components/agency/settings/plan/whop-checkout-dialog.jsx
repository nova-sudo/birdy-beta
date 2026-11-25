"use client";

// Whop's checkout in the kit's dialog: a plan, an extra client slot
// or a pack of credits. Whop's own form is a third-party embed.

import { createPortal } from "react-dom";
import { Dialog, DialogBody, DialogContent, Skeleton } from "@/components/by";
import { WhopCheckout } from "@/components/billing/whop-checkout";

/**
 * @param {string} props.title
 * @param {string} props.description
 * @param {string} props.planId the Whop plan id
 * @param {string} props.returnFlag the query flag Whop's returnUrl carries back, e.g. "checkout=success"
 * @param {() => void} props.onClose
 * @param {() => void} props.onComplete
 */
export function WhopCheckoutDialog({ title, description, planId, returnFlag, onClose, onComplete }) {
  const returnUrl = typeof window !== "undefined" ? `${window.location.origin}/settings?section=plan&${returnFlag}` : undefined;
  return (
    // Not a Radix modal: that blocks clicks on everything outside the dialog, and
    // Whop opens its security checks and the bank's confirmation on the page
    // body. The scrim covers the page instead, and a click outside keeps a
    // half-filled payment open.
    <Dialog open modal={false} onOpenChange={(open) => { if (!open) onClose(); }}>
      {createPortal(<div aria-hidden="true" data-testid="checkout-scrim" className="fixed inset-0 z-[49] bg-by-text/30" />, document.body)}
      <DialogContent title={title} description={description} className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogBody className="max-h-[70vh]">
          <WhopCheckout
            key={planId}
            planId={planId}
            returnUrl={returnUrl}
            onComplete={onComplete}
            fallback={
              <div className="space-y-3 py-2">
                <Skeleton className="h-10 w-full rounded-by-md" />
                <Skeleton className="h-10 w-full rounded-by-md" />
                <Skeleton className="h-12 w-full rounded-by-md" />
              </div>
            }
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
