// What Birdy offers to ask before you have typed anything.
//
// The chat opens beside whichever page you are on, so the first suggestions
// should be about that page rather than the same four chips everywhere. The
// page slug is the one BirdyChatModal already derives from the pathname and
// hands to the backend; this is the human side of the same key.
//
// Starters are plain prompts rather than anything computed from the page's
// data: the panel lives in the root layout, above the hubs, and has no access
// to their figures. A question the page can answer is enough.

export const PAGE_LABELS = {
  dashboard: "Dashboard",
  campaigns: "Marketing Hub",
  leads: "Lead Hub",
  call_center: "Sales Hub",
  alerts: "Alerts",
  custom_metrics: "Metrics",
  client_detail: "Client",
  opportunities: "Pipeline",
};

const GENERIC = [
  { label: "How are we doing today?", prompt: "How am I doing today across all client groups?" },
  { label: "Which clients need a look?", prompt: "Which clients need attention this week, and why?" },
  { label: "Best campaigns this week", prompt: "Which are my best performing campaigns this week?" },
  { label: "Create an alert", prompt: "Help me create an alert." },
];

const BY_PAGE = {
  dashboard: [
    { label: "Summarise the week", prompt: "Give me a summary of portfolio performance this week." },
    { label: "Biggest mover", prompt: "Which client moved the most this week, up or down, and why?" },
    { label: "Where is the funnel leaking?", prompt: "Where in the funnel are we losing the most this week?" },
    { label: "Create an alert", prompt: "Help me create an alert." },
  ],
  campaigns: [
    { label: "Why did CPL move?", prompt: "Why did the blended CPL move this week? Name the campaigns responsible." },
    { label: "What should I pause?", prompt: "Which campaigns should I pause this week, and what would it save?" },
    { label: "Best ad sets", prompt: "Which ad sets have the best CPL this week with meaningful spend?" },
    { label: "Compare with last week", prompt: "Compare this week vs last week across all my campaigns." },
  ],
  leads: [
    { label: "Leads to follow up", prompt: "Which leads need follow-up right now?" },
    { label: "Where are leads coming from?", prompt: "Which sources and campaigns produced this week's leads?" },
    { label: "Conversion by client", prompt: "Which clients convert leads best this week, and which worst?" },
    { label: "Missing contact details", prompt: "Which client groups have the most contacts with no email captured?" },
  ],
  call_center: [
    { label: "Who went quiet?", prompt: "Which clients had the fewest calls relative to their leads this week?" },
    { label: "Best callers", prompt: "Which call-centre members had the best answer and appointment rates this week?" },
    { label: "Analyse recent calls", prompt: "Analyse the most recent calls and tell me what's working and what isn't." },
    { label: "Inbound vs outbound", prompt: "How does inbound compare with outbound this week?" },
  ],
  alerts: [
    { label: "Create an alert", prompt: "Help me create an alert." },
    { label: "What triggered recently?", prompt: "Which alerts triggered recently and what should I do about them?" },
    { label: "Suggest alerts", prompt: "Suggest alerts I should set up for my clients based on their data." },
  ],
  custom_metrics: [
    { label: "Create a custom metric", prompt: "Help me create a new custom metric." },
    { label: "Explain a metric", prompt: "Explain how my custom metrics are calculated." },
  ],
  client_detail: [
    { label: "How is this client doing?", prompt: "How is this client performing this week?" },
    { label: "Against their targets", prompt: "How is this client tracking against their targets?" },
    { label: "What should I change?", prompt: "What should I change for this client this week?" },
  ],
};

/** Starters for a page slug; the generic set where a page has none. */
export function startersFor(page) {
  return BY_PAGE[page] ?? GENERIC;
}

/** The page's name as the context chip prints it, or null off any hub. */
export function pageLabel(page) {
  return PAGE_LABELS[page] ?? null;
}

/**
 * A greeting for the hour, for the Ask Birdy page's empty state.
 * @param {Date} [now]
 */
export function greetingFor(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
