"use client";

import { useEffect, useRef } from "react";
import { attachGaze } from "./birdy-gaze";
import { BIRDY_INNER_MARKUP } from "./birdy-markup";
import "./birdy-animations.css";

/**
 * The Birdy mascot — a live status indicator. Nine states, driven by one
 * attribute (`data-birdy-state`) on the SVG root; the CSS in
 * birdy-animations.css owns all the motion. See
 * design_handoff_birdy_animations/README.md for the full spec.
 *
 * Default state is "follow": the bird tracks the cursor whenever nothing
 * else is happening. Every other state is a temporary reaction — see
 * useBirdy()/flash() in use-birdy.js — that returns to "follow" (or
 * "loading", if a request is still in flight) on its own.
 *
 * Decorative by design: aria-hidden, no independent accessible meaning.
 * Wrap it in a link/label that already carries one.
 */
export default function Birdy({
  state = "follow",
  size = 36,
  speedK = 1,
  paused = false,
  className = "",
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || state !== "follow") return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: hover)").matches) return; // no cursor on touch
    return attachGaze(el);
  }, [state]);

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      className={`birdy ${className}`}
      data-birdy-state={state}
      data-birdy-paused={paused ? "true" : undefined}
      viewBox="0 0 2048 2048"
      style={{
        display: "block",
        overflow: "visible",
        width: `${size}px`,
        height: `${size}px`,
        "--birdy-size": `${size}px`,
        "--birdy-speed-k": String(speedK),
      }}
      dangerouslySetInnerHTML={{ __html: BIRDY_INNER_MARKUP }}
    />
  );
}
