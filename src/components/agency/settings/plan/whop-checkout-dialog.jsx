"use client";

// Whop's embedded checkout in the kit's dialog: a plan, an extra client slot
// or a pack of credits. Whop's own form is a third-party embed.

import { useState } from "react";
import { Check } from "lucide-react";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import { Dialog, DialogBody, DialogContent, Notice, Skeleton } from "@/components/by";
import { WHOP_ENVIRONMENT, storedEmail } from "@/components/billing/whop";

/**
 * @param {string} props.title
 * @param {string} props.description
 * @param {string} props.planId the Whop plan id
 * @param {string} props.returnFlag the query flag Whop's returnUrl carries back, e.g. "checkout=success"
 * @param {() => void} props.onClose
 * @param {() => void} props.onComplete
 */
export function WhopCheckoutDialog({ title, description, planId, returnFlag, onClose, onComplete }) {
  const [promo, setPromo] = useState(null);
  const [email] = useState(storedEmail);
  const returnUrl = typeof window !== "undefined" ? `${window.location.origin}/settings?section=plan&${returnFlag}` : undefined;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent title={title} description={description} className="max-w-md">
        <DialogBody className="max-h-[70vh]">
          {promo && (
            <Notice tone="success" icon={<Check aria-hidden="true" />} className="mb-3">
              <b className="font-semibold">{promo.code}</b> applied · {promo.type === "percentage" ? `${promo.amount}% off` : `$${promo.amount} off`}
            </Notice>
          )}
          <WhopCheckoutEmbed
            planId={planId}
            environment={WHOP_ENVIRONMENT}
            theme="light"
            skipRedirect
            returnUrl={returnUrl}
            prefill={email ? { email } : undefined}
            onComplete={onComplete}
            onPromoCodeChanged={setPromo}
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
