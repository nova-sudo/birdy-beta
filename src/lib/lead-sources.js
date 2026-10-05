// How a client collects their leads — the one definition every screen that asks
// or shows it reads from (new-client wizard, onboarding review, client page,
// tracking setup, the Tracking table), so the same choice is never described
// two ways. The backend's list is services/lead_collection.py; keep them in step.
//
// The question the three options really answer is "where does Birdy find this
// client's leads, and what does that need from us?":
//
//   instant_form  Meta hands them over. Nothing to set up.
//   form_to_ghl   A form tool (ROAS Forms on its own landing pages or embedded
//                 on the client's site, GHL forms and funnels…) sends each lead
//                 to GoHighLevel with the ad it came from. Nothing to install in
//                 Birdy: the attribution is switched on in the form tool, and
//                 Birdy attributes from GoHighLevel.
//   landing_page  The client's own page, with leads going to their own records
//                 or database. Birdy's pixel on that page is the only way we see
//                 them.

export const LEAD_SOURCE_OPTIONS = [
  {
    key: "instant_form",
    label: "Meta Instant Forms",
    short: "Meta forms",
    brief: "Nothing to set up",
    hint: "The form opens inside Facebook or Instagram and Meta sends us the leads. Nothing to set up.",
  },
  {
    key: "form_to_ghl",
    label: "A form tool that sends leads to GoHighLevel",
    short: "Form tool → GHL",
    brief: "ROAS Forms, GHL forms… Nothing to install",
    hint:
      "ROAS Forms (on its own landing pages or embedded on their site), GHL forms and funnels, or similar. " +
      "Nothing to install in Birdy: switch on sending attribution to GoHighLevel in the form tool, and Birdy attributes from GoHighLevel.",
  },
  {
    key: "landing_page",
    label: "Their own landing page and records",
    short: "Own landing page",
    brief: "Leads go to their own records. Needs the pixel",
    hint:
      "A page the client controls, with leads saved to their own records or database rather than GoHighLevel. " +
      "Needs the Birdy pixel installed on that page.",
  },
]

export const LEAD_SOURCE_UNKNOWN = {
  key: "unknown",
  label: "Ask later",
  short: "Not set",
  brief: "Decide later",
  hint: "Nothing changes for this client until you choose.",
}

// "external_form" was the old third option (a form tool wired to Birdy by
// webhook). Those tools can all send to GoHighLevel, so it reads as form_to_ghl.
const LEGACY = { external_form: "form_to_ghl" }

export function normalizeLeadSource(key) {
  const k = LEGACY[key] || key
  return LEAD_SOURCE_OPTIONS.some((o) => o.key === k) ? k : "unknown"
}

export function leadSourceOption(key) {
  const k = normalizeLeadSource(key)
  return LEAD_SOURCE_OPTIONS.find((o) => o.key === k) || LEAD_SOURCE_UNKNOWN
}

/** Only a client's own landing page needs Birdy's pixel installed. */
export function needsPixel(key) {
  return normalizeLeadSource(key) === "landing_page"
}
