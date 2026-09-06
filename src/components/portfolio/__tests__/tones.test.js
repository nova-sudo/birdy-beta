// The tone table.
//
// Tones are how a metric keeps its colour across screens — a stage in the
// funnel and its headline number in the KPI strip stay the same colour by
// saying the same word — so the two things worth pinning are that the word
// resolves, and that an unrecognised one still renders something.

import { describe, it, expect } from "vitest";
import { TONES, toneClass } from "@/components/portfolio/tones";

describe("toneClass", () => {
  it("resolves every tone in the table", () => {
    for (const [name, classes] of Object.entries(TONES)) {
      expect(toneClass(name)).toBe(classes);
    }
  });

  it("gives the unavailable tone the neutral pair, not a metric colour", () => {
    // A figure with no source has nothing to colour-code, and a lit chip
    // beside a grey dash reads as a live number that happens to be missing.
    // Both tokens already exist in globals.css — no new one was invented.
    expect(toneClass("neutral")).toBe("bg-pd-neutral-badge text-pd-subtle");
  });

  it("still renders something for a tone nobody defined", () => {
    // A missing tone is a mistake in a presentation table, not a reason for a
    // chip to lose its background and float unstyled on the card.
    expect(toneClass("chartreuse")).toBe(TONES.primary);
    expect(toneClass(undefined)).toBe(TONES.primary);
  });
});
