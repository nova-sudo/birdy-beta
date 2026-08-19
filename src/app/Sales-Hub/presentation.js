import { Clock, Phone, PhoneIncoming, PhoneOutgoing, Shuffle, Users } from "lucide-react";

// Which icon and colour family each Sales Hub figure wears.
//
// Kept apart from the data so the hook stays about numbers and this stays about
// how they read. Tones name a colour family rather than a hex — see
// components/portfolio/tones.js — so a metric keeps its colour wherever it is
// drawn, and the palette can move in one place.
//
// Every metric here is a volume: more calls, more leads reached and more talk
// time are all good news, so none of them inverts. The Marketing Hub's CPL is
// the sibling screen's counter-example, and DeltaPill already takes a polarity
// for exactly that reason — nothing on this screen needs to pass one.

/** The six tiles, in the design's order: left column top-to-bottom, then right. */
export const KPI_PRESENTATION = [
  { key: "called", label: "Leads called", icon: Users, tone: "primary" },
  { key: "calls", label: "Total calls", icon: Phone, tone: "info" },
  { key: "inbound", label: "Inbound", icon: PhoneIncoming, tone: "success" },
  { key: "outbound", label: "Outbound", icon: PhoneOutgoing, tone: "amber" },
  { key: "transfers", label: "Transfers", icon: Shuffle, tone: "info" },
  { key: "talk", label: "Talk time (min)", icon: Clock, tone: "primary" },
];
