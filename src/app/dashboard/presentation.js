import {
  CalendarCheck,
  CircleCheck,
  Layers,
  MessageCircle,
  Phone,
  PhoneCall,
  PoundSterling,
  Target,
  UserCheck,
  Users,
} from "lucide-react";

// Which icon and colour family each metric wears.
//
// This is the screen's, not the components': StatStrip, FunnelStepper and the
// rest take an icon and a tone name and render them, so the same components
// serve any other set of metrics.

export const KPI_PRESENTATION = {
  spend: { icon: PoundSterling, tone: "success" },
  leads: { icon: UserCheck, tone: "info" },
  cpl: { icon: Target, tone: "amber" },
  closes: { icon: CalendarCheck, tone: "primary" },
};

export const CALL_PRESENTATION = {
  total: { icon: Phone, tone: "primary" },
  speed: { icon: Target, tone: "amber" },
  // The handoff draws a phone crossed with an ×, which is lucide's
  // "phone-missed" — the opposite of what an answer rate means. Its own icon
  // table calls this one "phone-answer", so that is what it gets.
  answer: { icon: PhoneCall, tone: "info" },
  perLead: { icon: Layers, tone: "info" },
  perClose: { icon: Target, tone: "success" },
  conversion: { icon: CalendarCheck, tone: "success" },
};

/**
 * Which of those six figures a call centre has to report for.
 *
 * Five of the six. `conversion` is the odd one out and it is worth saying why,
 * because it sits in a card headed "Call insights" and looks like the others:
 * it is closes ÷ leads — GHL won opportunities over Meta results — and a
 * client with no dialler still has both. Greying it out would be telling the
 * reader we can't measure something we can measure perfectly well.
 *
 * `perClose` goes the other way and is included: calls ÷ closes has a real
 * denominator but no numerator, and a ratio is only as available as its worst
 * input.
 *
 * Mapped from buildCallInsights in lib/portfolio-aggregate.js, whose figures
 * come out of `hotprospector.call_stats` — the catalogue's "Call Center"
 * category, enumerated in lib/metric-sources.js.
 */
export const CALL_CENTRE_STAT_KEYS = ["total", "speed", "answer", "perLead", "perClose"];

/**
 * And which funnel stage. Exactly one: Called is the only stage the call
 * centre reports — Leads is Meta, In CRM and Closes are GHL opportunities.
 *
 * The stages after it stay real. That holds because this funnel is a cohort,
 * not a drop-off: every stage counts the same window's contacts and is
 * measured against the cohort rather than against the stage above it, so
 * Closes does not pass through Called on its way and does not become
 * unknowable when Called does. See buildFunnel's own note on the subject.
 */
export const CALL_CENTRE_FUNNEL_KEYS = ["called"];

// Tints run purple → blue → amber → green down the funnel, matching the KPI
// strip so a stage and its headline number read as the same thing.
export const FUNNEL_PRESENTATION = {
  leads: { icon: Users, tone: "primary" },
  engaged: { icon: MessageCircle, tone: "info" },
  called: { icon: PhoneCall, tone: "amber" },
  closes: { icon: CircleCheck, tone: "success" },
};

/** Merges a presentation table into rows keyed by `key`. */
export function withPresentation(rows, table, fallback = {}) {
  return (rows ?? []).map((row) => ({ ...row, ...(table[row.key] ?? fallback) }));
}
