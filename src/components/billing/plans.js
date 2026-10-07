import { Zap, TrendingUp, Building2 } from "lucide-react";

// The three subscription tiers, in one place: /billing sells them and the
// Settings Billing tab shows which one you're on, and the two used to carry
// their own copies of the list (Settings' had drifted to a name/colour stub
// with no prices). Whop plan IDs (plan_XXXXXXXX) come from the Whop dashboard
// (Checkout Links → Details) via env.
export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 97,
    maxClients: 3,
    planId: process.env.NEXT_PUBLIC_WHOP_PLAN_STARTER ?? "",
    icon: Zap,
    supportsExtraSlots: false,
    features: ["Up to 3 client groups"],
  },
  {
    id: "growth",
    name: "Growth",
    price: 297,
    maxClients: 10,
    planId: process.env.NEXT_PUBLIC_WHOP_PLAN_GROWTH ?? "",
    icon: TrendingUp,
    popular: true,
    supportsExtraSlots: false,
    features: ["Up to 10 client groups"],
  },
  {
    id: "scale",
    name: "Scale",
    price: 497,
    maxClients: 25,
    planId: process.env.NEXT_PUBLIC_WHOP_PLAN_SCALE ?? "",
    icon: Building2,
    supportsExtraSlots: true,
    features: [
      "Up to 25 client groups",
      "Extra client slots (+$10/mo each)",
    ],
  },
];

// Cheapest to dearest — an index comparison is what tells an upgrade from a
// downgrade.
export const PLAN_ORDER = ["starter", "growth", "scale"];

// Solid status pills: a filled colour with white text.
export const STATUS_STYLES = {
  active: "bg-pd-success text-white",
  trialing: "bg-pd-info text-white",
  past_due: "bg-pd-warning text-white",
  canceling: "bg-pd-warning text-white",
  canceled: "bg-pd-danger text-white",
  inactive: "bg-gray-600 text-white",
};

export const STATUS_LABELS = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past Due",
  canceling: "Canceling",
  canceled: "Canceled",
  inactive: "No Plan",
};
