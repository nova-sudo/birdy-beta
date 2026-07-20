// ─── Placeholder homepage data — FOR REVIEW ────────────────────────────────
// Used only until the backend endpoints in useDashboardData.js exist. Once
// those endpoints are live, real data replaces this automatically and this
// file becomes unused (safe to delete).

import { Pause, TrendingUp, Image as ImageIcon, DollarSign } from "lucide-react";

export const MOCK_SUGGESTIONS = [
  {
    id: "rec-1",
    severity: "HIGH",
    icon: Pause,
    client: "Palm Peach Body Sculpt",
    platform: "Meta Ads",
    title: "Pause 2 underperforming ads",
    description:
      "Both ads sit at £48 cost-per-lead against your £22 threshold and have driven 0 leads in 5 days. Pausing them redirects ~£310/wk to your top set.",
    stats: [
      { label: "CPL", value: "£48.00", bad: true },
      { label: "Target", value: "£22.00" },
      { label: "Spent (5d)", value: "£312" },
      { label: "Leads", value: "0" },
    ],
  },
  {
    id: "rec-2",
    severity: "OPPORTUNITY",
    icon: TrendingUp,
    client: "BBL Body Confidence",
    platform: "Meta Ads",
    title: "Scale winning ad set — increase budget +20%",
    description:
      "ROAS is holding at 4.9x with CPL trending down 18% over 7 days. Room to scale before fatigue sets in.",
    stats: [],
  },
  {
    id: "rec-3",
    severity: "MEDIUM",
    icon: ImageIcon,
    client: "The Body Room",
    platform: "Meta Ads",
    title: "Refresh ad creative — fatigue detected",
    description: "CTR dropped 4.8% → 2.1% over 7 days · frequency 3.4",
    stats: [],
  },
  {
    id: "rec-4",
    severity: "MEDIUM",
    icon: DollarSign,
    client: "The Contour Co",
    platform: "Meta Ads",
    title: "Lower daily budget to £40",
    description: "Spend pacing 34% ahead of monthly cap with CPL rising · protect budget",
    stats: [],
  },
  {
    id: "rec-5",
    severity: "OPPORTUNITY",
    icon: TrendingUp,
    client: "Konfidence Clinic",
    platform: "Meta Ads",
    title: "Duplicate top ad set to a lookalike audience",
    description: "Best set converting at £14 CPL · a 2% lookalike could expand reach at similar cost",
    stats: [],
  },
  {
    id: "rec-6",
    severity: "MEDIUM",
    icon: ImageIcon,
    client: "Fake It Aesthetics",
    platform: "Meta Ads",
    title: "Swap primary text on lead ad",
    description: "Hook is 3 weeks old and CTR softening · a fresh angle should lift engagement",
    stats: [],
  },
  {
    id: "rec-7",
    severity: "MEDIUM",
    icon: DollarSign,
    client: "Aura",
    platform: "Meta Ads",
    title: "Cap frequency at 2.5",
    description: "Frequency climbing to 3.8 on the retargeting set · trim to avoid ad fatigue",
    stats: [],
  },
  {
    id: "rec-8",
    severity: "OPPORTUNITY",
    icon: TrendingUp,
    client: "Tylaesthetics",
    platform: "Meta Ads",
    title: "Extend budget into the weekend",
    description: "Weekend CPL runs 21% below weekday · shifting spend should add cheap leads",
    stats: [],
  },
  {
    id: "rec-9",
    severity: "MEDIUM",
    icon: ImageIcon,
    client: "The Body Room",
    platform: "Meta Ads",
    title: "Consolidate 3 overlapping ad sets",
    description: "Audiences overlap 46% and bidding against each other · merge to cut waste",
    stats: [],
  },
  {
    id: "rec-10",
    severity: "HIGH",
    icon: ImageIcon,
    client: "Contoured Body Bedford",
    platform: "Meta Ads",
    title: "Pause ad with rising CPL",
    description: "CPL up 62% in 4 days to £39 with no conversions · pause before spend climbs",
    stats: [],
  },
  {
    id: "rec-11",
    severity: "OPPORTUNITY",
    icon: TrendingUp,
    client: "V Rejuvederm",
    platform: "Meta Ads",
    title: "Test a new video creative",
    description: "Static ads plateauing · a short video hook could reopen cheap reach",
    stats: [],
  },
];

export const MOCK_ALERTS = [
  {
    id: "alert-1",
    color: "amber",
    client: "Palm Peach Body Sculpt",
    title: "Zero ad spend threshold breached",
    badge: "Auto-run by Birdy",
    badgeTone: "purple",
    cta: "Open client",
    ctaVariant: "filled",
    actionKey: "open_client",
  },
  {
    id: "alert-2",
    color: "red",
    client: "The Contour Co",
    title: "Leads not syncing to CRM",
    badge: "Needs approval",
    badgeTone: "gray",
    cta: "View all",
    ctaVariant: "outline",
    actionKey: "view_all",
  },
  {
    id: "alert-3",
    color: "red",
    client: "Sculpted By Jo",
    title: "Leads not syncing to CRM",
    badge: "Auto-run by Birdy",
    badgeTone: "purple",
    cta: "View all",
    ctaVariant: "outline",
    actionKey: "view_all",
  },
];

export const MOCK_WINS = [
  {
    id: "win-1",
    client: "Aura",
    title: "Record week — 806 clicks at 4.83% CTR",
    description: "Best performance this quarter on just £84 spend. Worth sharing a quick win update with the client.",
  },
  {
    id: "win-2",
    client: "Tylaesthetics",
    title: "Cost-per-lead down 22% week-on-week",
    description: "744 clicks at 4.49% CTR after last week's budget shift to Campaign B.",
  },
];

export const MOCK_ACTIVITY = [
  { id: "a1",  actor: "birdy", title: "Paused 3 underperforming ads",  client: "The Contour Co",           time: "2h ago" },
  { id: "a2",  actor: "user",  title: "Increased budget +20%",         client: "Aura",                     time: "3h ago" },
  { id: "a3",  actor: "birdy", title: "Shifted budget to Campaign B",  client: "Tylaesthetics",             time: "4h ago" },
  { id: "a4",  actor: "user",  title: "Refreshed ad creative",         client: "Simplea You",               time: "5h ago" },
  { id: "a5",  actor: "birdy", title: "Lowered daily cap to £40",      client: "Konfidence Clinic",          time: "6h ago" },
  { id: "a6",  actor: "user",  title: "Re-enabled top ad set",         client: "Sculpted By Jo",             time: "7h ago" },
  { id: "a7",  actor: "birdy", title: "Paused ad with 0 conversions",  client: "Contoured Body Bedford",     time: "8h ago" },
  { id: "a8",  actor: "user",  title: "Duplicated top ad set",         client: "V Rejuvederm",               time: "9h ago" },
  { id: "a9",  actor: "birdy", title: "Raised bid cap by 10%",         client: "Thee Vision Studio",         time: "10h ago" },
  { id: "a10", actor: "user",  title: "Refreshed creative set",        client: "Aura",                       time: "11h ago" },
  { id: "a11", actor: "birdy", title: "Merged overlapping ad sets",    client: "The Body Room",              time: "12h ago" },
  { id: "a12", actor: "user",  title: "Extended weekend budget",       client: "Tylaesthetics",              time: "13h ago" },
  { id: "a13", actor: "birdy", title: "Capped frequency at 2.5",       client: "Fake It Aesthetics",         time: "14h ago" },
  { id: "a14", actor: "user",  title: "Launched video creative test",  client: "V Rejuvederm",               time: "15h ago" },
];

export const MOCK_TAB_COUNTS = { suggestions: 12, alerts: 3, wins: 5 };
