"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";

/*
 * Birdy's motion kit. The feel is deliberately expressive: things rise a fair
 * way, overshoot a touch and settle, and the AI's own surfaces arrive last with
 * a small pop. Every piece honours the OS "reduce motion" setting — the root
 * layout sets <MotionConfig reducedMotion="user">, which turns transforms off
 * and keeps only opacity, and CountUp checks it directly.
 */

/** Overshoots slightly and settles — the signature curve. */
export const EASE_SPRING = [0.34, 1.56, 0.64, 1];
/** A plain fast-out curve, for things that should not bounce (bars, fades). */
export const EASE_OUT = [0.2, 0.8, 0.2, 1];

export const DURATION = 0.6;
export const RISE = 28;
export const STAGGER = 0.11;

const itemVariants = {
  hidden: { opacity: 0, y: RISE, scale: 0.94 },
  // `custom` carries a Reveal's own delay; under a Stagger it is unset and
  // the parent's staggerChildren spaces the items out instead.
  shown: (delay) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURATION, ease: EASE_SPRING, ...(delay ? { delay } : {}) },
  }),
};

/** Fades and rises a single block in on mount. */
export function Reveal({ as = "div", delay = 0, className, children, ...props }) {
  const M = motion[as] ?? motion.div;
  return (
    <M
      className={className}
      initial="hidden"
      animate="shown"
      variants={itemVariants}
      custom={delay}
      {...props}
    >
      {children}
    </M>
  );
}

/** Container whose StaggerItem children enter one after another. */
export function Stagger({ as = "div", delay = 0, gap = STAGGER, className, children, ...props }) {
  const M = motion[as] ?? motion.div;
  return (
    <M
      className={className}
      initial="hidden"
      animate="shown"
      variants={{ hidden: {}, shown: { transition: { staggerChildren: gap, delayChildren: delay } } }}
      {...props}
    >
      {children}
    </M>
  );
}

export function StaggerItem({ as = "div", className, children, ...props }) {
  const M = motion[as] ?? motion.div;
  return (
    <M className={className} variants={itemVariants} {...props}>
      {children}
    </M>
  );
}

/**
 * The AI's own cards (recommendations, insights) arrive with a small pop so
 * Birdy's voice stands apart from the data around it.
 */
export function Pop({ as = "div", delay = 0.35, className, children, ...props }) {
  const M = motion[as] ?? motion.div;
  return (
    <M
      className={className}
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: [0.9, 1.03, 1] }}
      transition={{ duration: DURATION * 1.3, delay, ease: EASE_SPRING, times: [0, 0.7, 1] }}
      {...props}
    >
      {children}
    </M>
  );
}

// "£18,903.17", "1,284", "47.2%", "4m 12s" — the leading number is what
// counts; whatever sits either side of it is kept as written.
const NUMBER = /^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/s;

/**
 * Counts a pre-formatted figure up from zero when it first appears, ending
 * on exactly the string it was given. The final value is what renders first
 * (server render, no-JS, tests, screen readers), and the count only plays
 * where the browser can say the element is on screen.
 */
export function CountUp({ value, duration = 1.2, className }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const text = value == null ? "" : String(value);

  useEffect(() => {
    const el = ref.current;
    const match = NUMBER.exec(text);
    if (!el || !match || reduce || typeof IntersectionObserver === "undefined") return;

    const [, before, digits, after] = match;
    const target = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(target) || target === 0) return;
    const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
    const grouped = digits.includes(",");
    const format = (n) =>
      before +
      n.toLocaleString("en-GB", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: grouped,
      }) +
      after;

    let controls;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      controls = animate(0, target, {
        duration,
        ease: EASE_OUT,
        onUpdate: (n) => { el.textContent = format(n); },
        onComplete: () => { el.textContent = text; },
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      controls?.stop();
      el.textContent = text;
    };
  }, [text, duration, reduce]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {text}
    </span>
  );
}
