"use client";

// Whop's checkout as the app shows it: Whop Elements, the only embed Whop
// still serves. (@whop/checkout framed whop.com/embedded/checkout, which Whop
// retired: it now answers "This checkout is no longer available" for every
// plan.) Used by Settings' checkout dialog and by setup's plan step.

import { useState } from "react";
import { loadWhop } from "@whop/elements";
import { Checkout, CheckoutElement, WhopElements } from "@whop/elements-react";
import { Button, Notice } from "@/components/by";
import { WHOP_ENVIRONMENT, storedEmail } from "./whop";

const APPEARANCE = { theme: { appearance: "light" } };

/**
 * Whop fixes the plan when the checkout opens, so give it a `key` that changes with the plan.
 *
 * @param {string} props.planId the Whop plan id
 * @param {string} props.returnUrl where Whop sends the browser after a payment step off the page, whatever its outcome
 * @param {() => void} props.onComplete
 * @param {() => void} [props.onReady]
 * @param {React.ReactNode} [props.fallback] shown while it loads
 */
export function WhopCheckout({ planId, returnUrl, onComplete, onReady, fallback }) {
  const [elements, setElements] = useState(() => loadWhop());
  const [email] = useState(storedEmail);
  const [failed, setFailed] = useState(null); // "load" | "unavailable"
  const [attempt, setAttempt] = useState(0);

  if (failed) {
    const again = () => {
      setElements(elements.retry());
      setFailed(null);
      setAttempt((n) => n + 1);
    };
    return (
      <Notice tone="danger" action={<Button size="sm" onClick={again}>Try again</Button>}>
        {failed === "unavailable" ? "Whop isn’t selling this right now." : "The checkout didn’t load. Check your connection and try again."}
      </Notice>
    );
  }
  return (
    <WhopElements
      key={attempt}
      elements={elements}
      environment={WHOP_ENVIRONMENT}
      appearance={APPEARANCE}
      onLoadError={() => setFailed("load")}
    >
      <Checkout
        plan={planId}
        returnUrl={returnUrl}
        // The account id is the email. The webhook reads it from here first, so
        // a purchase made under another email still lands on this account.
        metadata={email ? { user_id: email } : undefined}
        onComplete={onComplete}
        fallback={fallback}
      >
        <CheckoutElement
          buyerEmail={email || undefined}
          onReady={onReady}
          onError={(e) => setFailed(e?.code === "CHECKOUT_UNAVAILABLE" ? "unavailable" : "load")}
        />
      </Checkout>
    </WhopElements>
  );
}
