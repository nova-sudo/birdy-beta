// Single source of truth for the app version label and the /changelog history.
//
// Curated from the merged pull-request history (release-grouped, human-readable).
// The header version pill, the sidebar label, and the changelog page all read
// from here, so the version shown to users is defined in exactly one place.
//
// Newest release first. `APP_VERSION` is derived from RELEASES[0] so bumping the
// version is just adding a new entry at the top.

export const RELEASES = [
  {
    version: "Beta 1.7",
    date: "2026-07-27",
    summary:
      "Birdy can now think like a media buyer — a new opt-in capability that reads performance end to end.",
    changes: {
      added: [
        "Media Buying Analyst: enable it in Settings → Capabilities to give Birdy chat senior media-buyer reasoning — what to scale, kill, and fix across campaigns, ad sets, and ads.",
        "Lead-quality analysis from ad spend all the way to revenue: Meta leads → GoHighLevel opportunities → HotProspector connect rate, so cheap-but-dead “zombie” leads get caught.",
        "A new Capabilities tab in Settings to turn Birdy's agent abilities on and off.",
      ],
      improved: [
        "Birdy can now read call-center connect rate and coverage per client when judging lead quality.",
      ],
      fixed: [],
    },
  },
  {
    version: "Beta 1.6",
    date: "2026-07-23",
    summary:
      "Client history, a refreshed top bar, and tighter client-group scoping across the app.",
    changes: {
      added: [
        "Client history: a running activity log on each client page.",
        "Quick-access integrations menu in the top bar.",
      ],
      improved: [
        "Call Centre now follows the client group you have selected.",
        "Redesigned top bar featuring the Birdy mascot.",
        "Activity feed is capped with smooth scrolling so long lists stay tidy.",
      ],
      fixed: [
        "Insights tab is hidden for now while it is being reworked.",
      ],
    },
  },
  {
    version: "Beta 1.5",
    date: "2026-07-20",
    summary:
      "A reimagined home dashboard built around Birdy's suggestions, alerts, and wins.",
    changes: {
      added: [
        'New home dashboard with Suggestions, Alerts, and Wins tabs and a live activity feed.',
        '"Do it for me" AI actions, each with an Undo so nothing is one-way.',
        "Public landing page for signed-out visitors.",
      ],
      improved: [
        "Status column added to the Client Hub for an at-a-glance read.",
      ],
      fixed: [],
    },
  },
  {
    version: "Beta 1.4",
    date: "2026-07-09",
    summary: "Deeper call and lead reporting across the Sales Hub.",
    changes: {
      added: [
        "Calls tab in the Sales Hub.",
        "Talk-time broken down per client.",
        "Internal AI data integration for richer answers from Birdy.",
      ],
      improved: [
        "Sortable columns in the Call Center.",
        "Notification trigger dates surfaced in the header.",
        "Clearer empty-state indicator when a client has no leads last year.",
      ],
      fixed: [
        "Client picker dropdown sizing.",
        "Removed a dead 'view all alerts' link.",
      ],
    },
  },
  {
    version: "Beta 1.3",
    date: "2026-06-01",
    summary: "Lead classification, metric tooling, and a batch of stability fixes.",
    changes: {
      added: [
        "Lead classification cards.",
        "Duplicate a metric to branch from an existing one.",
        "Column order now saves automatically.",
      ],
      improved: [
        "Leads Hub cards rearranged into a single row.",
      ],
      fixed: [
        "Integration state now stays in sync after reconnecting.",
        "Assorted marketing and dashboard page fixes.",
      ],
    },
  },
  {
    version: "Beta 1.2",
    date: "2026-05-23",
    summary: "Account approval, richer settings, and a cleaner client selector.",
    changes: {
      added: [
        "Admin approval step for new sign-ups.",
        "More account detail on the settings page.",
      ],
      improved: [
        "Refined client selector on the marketing and leads pages.",
      ],
      fixed: [
        "Saving a view on the marketing page.",
        "Stray infinity symbols in some number cells.",
        "Refresh button is disabled while data is loading.",
      ],
    },
  },
  {
    version: "Beta 1.1",
    date: "2026-05-14",
    summary: "Alert presets, client statuses, and table controls.",
    changes: {
      added: [
        "Alert presets for common thresholds.",
        "Client status toggles.",
      ],
      improved: [
        "Sortable columns on the marketing table.",
        "Search filtering across lists.",
        "Metric builder updates for custom values.",
      ],
      fixed: [
        "Internal page rendering bug.",
        "Marketing table text truncation.",
      ],
    },
  },
  {
    version: "Beta 1.0",
    date: "2026-03-25",
    summary: "The foundation: the core hubs and navigation Birdy is built on.",
    changes: {
      added: [
        "Main Hub, Client Hub, and Metrics Hub.",
        "App-wide navigation.",
        "Skeleton loaders for a smoother first paint.",
      ],
      improved: [],
      fixed: [],
    },
  },
];

// The label shown in the header pill and sidebar. Derived from the latest release.
export const APP_VERSION = RELEASES[0].version;
