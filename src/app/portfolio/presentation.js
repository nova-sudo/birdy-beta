import {
  CalendarCheck,
  CircleCheck,
  Eye,
  Layers,
  MessageCircle,
  MessageCircleMore,
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

// Tints run purple → blue → amber → red → green down the funnel, matching the
// KPI strip so a stage and its headline number read as the same thing.
export const FUNNEL_PRESENTATION = {
  leads: { icon: Users, tone: "primary" },
  engaged: { icon: MessageCircle, tone: "info" },
  convos: { icon: MessageCircleMore, tone: "warning" },
  closes: { icon: CircleCheck, tone: "danger" },
  shows: { icon: Eye, tone: "success" },
};

/** Merges a presentation table into rows keyed by `key`. */
export function withPresentation(rows, table, fallback = {}) {
  return (rows ?? []).map((row) => ({ ...row, ...(table[row.key] ?? fallback) }));
}
