"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { attachGaze } from "./birdy-gaze";
import { BIRDY_INNER_MARKUP } from "./birdy-markup";
import "./birdy-animations.css";

gsap.registerPlugin(useGSAP);

// Every state's CSS keyframe starts at 0% from a fixed pose. Switching
// data-birdy-state used to hard-cut straight to that pose, regardless of
// where the previous animation actually was — the "stutter" this bridges.
// Rest pose per part, matched to what each state's own 0% keyframe expects
// (birdy-animations.css) so the handoff from the bridge to the CSS
// animation is seamless instead of introducing a second cut.
const REST_POSE = {
  bird: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  eyeL: { x: 0, y: 0 },
  eyeR: { x: 0, y: 0 },
  lidL: { scaleY: 0 },
  lidR: { scaleY: 0 },
};

// transform-origin baked into the markup for each part — GSAP needs this
// spelled out explicitly rather than inferred, or it defaults to the
// wrong pivot and the bridge tween swings around the wrong point.
const ORIGIN = {
  bird: "1024px 2100px",
  eyeL: "504px 1359px",
  eyeR: "1544px 1359px",
  lidL: "504px 1041px",
  lidR: "1544px 1041px",
};

// A few states' 0% keyframe isn't the rest pose (loading's eyes orbit in
// from an offset, error/no's lids are already half down, love's eyes are
// mid-converge, peek's bird starts below the frame entirely) — bridge
// straight to those instead of rest, or the handoff itself would cut.
function entryOverrides(incomingState, peekPose) {
  switch (incomingState) {
    case "loading":
      return { eyeL: { x: 34, y: -28 }, eyeR: { x: 34, y: -28 } };
    case "error":
    case "no":
      return { lidL: { scaleY: 0.36 }, lidR: { scaleY: 0.36 } };
    case "love":
      return { eyeL: { x: 26, y: 0 }, eyeR: { x: -26, y: 0 } };
    case "peek":
      return {
        bird: { y: 760, x: peekPose.x, rotation: peekPose.rot },
        eyeL: { x: -34 + peekPose.eyeX, y: -46 + peekPose.eyeY },
        eyeR: { x: -34 + peekPose.eyeX, y: -46 + peekPose.eyeY },
      };
    default:
      return {};
  }
}

function randomPeekPose() {
  return {
    x: Math.round(Math.random() * 120 - 60),
    rot: +(Math.random() * 16 - 8).toFixed(1),
    eyeX: Math.round(Math.random() * 70 - 40),
    eyeY: Math.round(Math.random() * 30 - 60),
  };
}

const BRIDGE_DURATION = 0.2;
const PARTS = ["bird", "eyeL", "eyeR", "lidL", "lidR"];

/**
 * The Birdy mascot — a live status indicator. Nine states, driven by one
 * attribute (`data-birdy-state`) on the SVG root; the CSS in
 * birdy-animations.css owns the actual per-state motion. See
 * design_handoff_birdy_animations/README.md for the full spec.
 *
 * Default state is "follow": the bird tracks the cursor whenever nothing
 * else is happening. Every other state is a temporary reaction — see
 * useBirdy()/flash() in use-birdy.js — that returns to "follow" (or
 * "loading", if a request is still in flight) on its own, with a "peek"
 * settling beat and idle fidget in between (see birdy-store.js).
 *
 * `data-birdy-state` is applied imperatively, not bound directly to the
 * `state` prop: on every change, a short GSAP tween eases the bird/eyes/
 * lids from wherever they currently are to the new state's starting pose
 * *before* handing off to its CSS keyframe — otherwise switching states
 * (which now happens often, between loading/peek/follow) hard-cuts.
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
  const appliedStateRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || state !== "follow") return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: hover)").matches) return; // no cursor on touch
    return attachGaze(el);
  }, [state]);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      // First paint — nothing to bridge from yet.
      if (appliedStateRef.current === null) {
        el.setAttribute("data-birdy-state", state);
        appliedStateRef.current = state;
        return;
      }
      if (appliedStateRef.current === state) return;

      const reduced =
        paused ||
        (typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (reduced) {
        el.setAttribute("data-birdy-state", state);
        appliedStateRef.current = state;
        return;
      }

      const peekPose = state === "peek" ? randomPeekPose() : null;
      if (peekPose) {
        el.style.setProperty("--birdy-peek-x", `${peekPose.x}px`);
        el.style.setProperty("--birdy-peek-rot", `${peekPose.rot}deg`);
        el.style.setProperty("--birdy-peek-eye-x", `${peekPose.eyeX}px`);
        el.style.setProperty("--birdy-peek-eye-y", `${peekPose.eyeY}px`);
      }
      const overrides = entryOverrides(state, peekPose);

      const nodes = [];
      const tl = gsap.timeline({
        defaults: { duration: BRIDGE_DURATION, ease: "power2.out", overwrite: "auto" },
        onComplete: () => {
          gsap.set(nodes, { clearProps: "transform,transformOrigin" });
          nodes.forEach((n) => {
            n.style.animationPlayState = "";
          });
          el.setAttribute("data-birdy-state", state);
          appliedStateRef.current = state;
        },
      });

      for (const part of PARTS) {
        const node = el.querySelector(`[data-p="${part}"]`);
        if (!node) continue;
        nodes.push(node);
        node.style.animationPlayState = "paused"; // freeze at its current CSS-animated pose
        tl.to(
          node,
          { ...REST_POSE[part], ...(overrides[part] || {}), transformOrigin: ORIGIN[part] },
          0
        );
      }
    },
    { scope: ref, dependencies: [state] }
  );

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      className={`birdy ${className}`}
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
