import { Building2, Megaphone, Palette, Phone, Users } from "lucide-react";

/**
 * The app's sections, in rail order. Each has one colour pair: `tile` for its
 * resting icon tile, `solid` for the tile when the section is open.
 *
 * `enabled: false` keeps a section out of the rail without deleting it.
 */
export const SECTIONS = [
  { id: "ops", name: "Agency Ops", description: "Your entire agency", icon: Building2, tile: "bg-by-ops-bg text-by-ops", solid: "bg-by-ops text-by-on-accent", enabled: true },
  { id: "buyer", name: "Media Buyer", description: "Your entire agency", icon: Megaphone, tile: "bg-by-buyer-bg text-by-buyer", solid: "bg-by-buyer text-by-on-accent", enabled: true },
  { id: "coach", name: "Sales Coach", description: "Your entire agency", icon: Phone, tile: "bg-by-coach-bg text-by-coach", solid: "bg-by-coach text-by-on-accent", enabled: true },
  // Hidden for launch. Its colour has not been chosen, so it borrows the neutral tile.
  { id: "creative", name: "Creative Strategist", description: "Your entire agency", icon: Palette, tile: "bg-by-sunken text-by-text-2", solid: "bg-by-text text-by-on-accent", enabled: false },
  // Off the rail: Agency Ops' Dashboard tab is the same Clients table. The /clients page still works.
  { id: "clients", name: "Clients", description: "Every client you run", icon: Users, tile: "bg-by-clients-bg text-by-clients", solid: "bg-by-clients text-by-on-accent", enabled: false },
];

/** The sections shown on the rail. */
export const visibleSections = (sections = SECTIONS) => sections.filter((s) => s.enabled);
