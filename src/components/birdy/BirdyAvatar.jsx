"use client";

import Birdy from "./Birdy";
import { cn } from "@/lib/utils";

const TONES = {
  // The sidebar's frame: primary-soft tint with a hairline primary border.
  tint: "border-primary/20 bg-primary-soft",
  // For surfaces that are already tinted (onboarding, coloured panels).
  white: "border-border bg-background",
};

/**
 * The mascot as Birdy shows it everywhere: seated in a round frame, standing
 * on the bottom edge and cropped by the circle. Never place a bare <Birdy>;
 * wrap it in this so every appearance matches the one in the sidebar.
 *
 * @param {number} size diameter of the frame in px; the bird is ~82% of it
 * @param {"tint"|"white"} tone frame colour
 */
export default function BirdyAvatar({ size = 40, tone = "tint", className, ...birdyProps }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-end justify-center overflow-hidden rounded-full border",
        TONES[tone] ?? TONES.tint,
        className
      )}
      style={{ width: size, height: size }}
    >
      <Birdy size={Math.round(size * 0.82)} {...birdyProps} />
    </span>
  );
}
