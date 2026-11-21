"use client";

// Settings › Plan & credits: "Your plan" and "AI credits" side by side, with
// Compare plans, Top up and Whop's checkout in dialogs. Took over from
// /billing and /credits, which now redirect here (Whop's return flags too).

import { useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Button, Notice } from "@/components/by";
import { useBilling } from "./plan/use-billing";
import { useCreditUsage } from "./plan/use-credit-usage";
import { YourPlanCard } from "./plan/your-plan-card";
import { AiCreditsCard } from "./plan/ai-credits-card";
import { ComparePlansDialog } from "./plan/compare-plans-dialog";
import { TopUpDialog } from "./plan/top-up-dialog";
import { WhopCheckoutDialog } from "./plan/whop-checkout-dialog";

function Dismiss({ onClick }) {
  return <Button kind="ghost" size="sm" onClick={onClick}>Dismiss</Button>;
}

export function PlanSection() {
  const billing = useBilling();
  const credits = useCreditUsage();
  const [comparing, setComparing] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);

  return (
    <div className="flex flex-col gap-3.5">
      {billing.success && <Notice tone="success" icon={<Check aria-hidden="true" />} action={<Dismiss onClick={billing.clearSuccess} />}>{billing.success}</Notice>}
      {credits.success && <Notice tone="success" icon={<Check aria-hidden="true" />} action={<Dismiss onClick={credits.clearSuccess} />}>{credits.success}</Notice>}
      {billing.error && <Notice tone="danger" icon={<AlertCircle aria-hidden="true" />} action={<Dismiss onClick={billing.clearError} />}>{billing.error}</Notice>}

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
        <YourPlanCard billing={billing} onCompare={() => setComparing(true)} />
        <AiCreditsCard usage={credits} onTopUp={() => setToppingUp(true)} />
      </div>

      <ComparePlansDialog
        open={comparing}
        onOpenChange={setComparing}
        // Without a plan the choice opens Whop's checkout, which takes this dialog's place.
        billing={{ ...billing, choosePlan: (plan) => { if (!billing.status?.subscribed) setComparing(false); billing.choosePlan(plan); } }}
      />
      <TopUpDialog
        open={toppingUp}
        onOpenChange={setToppingUp}
        packs={credits.packs}
        loading={credits.packsLoading}
        onPick={(pack) => { setToppingUp(false); credits.pickPack(pack); }}
      />

      {billing.checkout && (
        <WhopCheckoutDialog
          title={`Subscribe to ${billing.checkout.name}`}
          description={`$${billing.checkout.price}/mo · Secure checkout powered by Whop`}
          planId={billing.checkout.planId}
          returnFlag="checkout=success"
          onClose={billing.closeCheckout}
          onComplete={billing.checkoutDone}
        />
      )}
      {credits.pack && (
        <WhopCheckoutDialog
          title={`${credits.pack.credits.toLocaleString("en-GB")} Birdy credits`}
          description={`$${credits.pack.price} · Secure checkout powered by Whop`}
          planId={credits.pack.plan_id}
          returnFlag="topup=success"
          onClose={credits.closePack}
          onComplete={credits.topupDone}
        />
      )}
    </div>
  );
}
