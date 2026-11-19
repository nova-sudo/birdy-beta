"use client";

import Birdy from "@/components/birdy/Birdy";
import { cn } from "./cn";

/**
 * Birdy in the round frame. The mascot never appears without it.
 *
 * Decorative by default: the mascot's face glyphs are SVG text and must not
 * leak into the name of whatever it sits beside.
 *
 * @param {24|32|40|56} [props.size] diameter in px; the bird is 82% of it and stands on the bottom edge
 */
export function BirdyAvatar({ size = 40, className, ...birdyProps }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-end justify-center overflow-hidden rounded-full border border-by-accent-line bg-by-accent-soft", className)}
      style={{ width: size, height: size }}
    >
      <Birdy size={Math.round(size * 0.82)} {...birdyProps} />
    </span>
  );
}

const TILE_SIZE = { 24: "size-6 rounded-by-sm text-by-caption", 32: "size-8 rounded-by-md text-by-body-sm", 40: "size-10 rounded-by-lg text-by-body" };

/**
 * A client shown as its initial on a tinted tile.
 * @param {string} props.name the client's name; the first letter is shown
 * @param {24|32|40} [props.size]
 */
export function ClientTile({ name, size = 32, className, ...props }) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center bg-by-accent-soft font-by-body font-semibold text-by-accent", TILE_SIZE[size] ?? TILE_SIZE[32], className)}
      {...props}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * The signed-in person, as a round initial.
 * @param {string} props.name
 */
export function UserAvatar({ name, className, ...props }) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-by-warning-bg font-by-body text-by-body font-semibold text-by-warning", className)}
      {...props}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
