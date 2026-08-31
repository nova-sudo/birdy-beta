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
    color: "blue",
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
    color: "purple",
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
    color: "emerald",
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

export const COLOR_CLASSES = {
  blue: { bg: "bg-blue-600", light: "bg-blue-50", border: "border-blue-500", text: "text-blue-600", button: "bg-blue-600 hover:bg-blue-700", badge: "bg-blue-100 text-blue-700" },
  purple: { bg: "bg-purple-600", light: "bg-purple-50", border: "border-purple-500", text: "text-purple-600", button: "bg-purple-600 hover:bg-purple-700", badge: "bg-purple-100 text-purple-700" },
  emerald: { bg: "bg-emerald-600", light: "bg-emerald-50", border: "border-emerald-500", text: "text-emerald-600", button: "bg-emerald-600 hover:bg-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
};

// Semantic pairs from the style guide — a text colour and its tint, never one
// without the other. Used by the Settings picker's status pill.
export const STATUS_STYLES = {
  active: "bg-pd-success-bg text-pd-success",
  trialing: "bg-pd-info-bg text-pd-info",
  past_due: "bg-pd-warning-bg text-pd-warning",
  canceling: "bg-pd-warning-bg text-pd-warning",
  canceled: "bg-pd-danger-bg text-pd-danger",
  inactive: "bg-pd-divider text-pd-subtle",
};

export const STATUS_LABELS = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past Due",
  canceling: "Canceling",
  canceled: "Canceled",
  inactive: "No Plan",
};
