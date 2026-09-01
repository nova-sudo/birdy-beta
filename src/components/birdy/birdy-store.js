// Global Birdy state — a plain external store (no React context needed) so
// non-component code (src/lib/api.js) can drive the mascot the same way
// components do, via `setBusy` / `flash` imported directly.
//
// `follow` is the default. `loading` holds for as long as any request is in
// flight (ref-counted). The seven reactions replace whatever is showing for
// one cycle, then fall back — see design_handoff_birdy_animations/README.md.

const REACTION_MS = {
  success: 2100,
  error: 2800,
  no: 1500,
  celebrate: 1200,
  love: 2200,
  alert: 2400,
  peek: 3400,
};

// Priority when several could apply — lower rank wins.
// alert > error/no > success/celebrate/love > loading > peek > follow
const RANK = {
  alert: 0,
  error: 1,
  no: 1,
  success: 2,
  celebrate: 2,
  love: 2,
  loading: 3,
  peek: 4,
  follow: 5,
};

let busyCount = 0;
let reaction = null; // current reaction state, or null
let reactionTimer = null;
const listeners = new Set();

function notify() {
  for (const listener of listeners) listener();
}

function computeState() {
  if (reaction) return reaction;
  if (busyCount > 0) return "loading";
  return "follow";
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBirdyState() {
  return computeState();
}

/** Ref-counted: pair every setBusy(true) with a setBusy(false). */
export function setBusy(active) {
  const next = Math.max(0, busyCount + (active ? 1 : -1));
  if (next === busyCount) return;
  busyCount = next;
  notify();
}

/** Show `state` for one cycle, then fall back to loading/follow. */
export function flash(state) {
  if (!(state in REACTION_MS)) return;
  if (reaction && RANK[reaction] < RANK[state]) return; // a higher-priority reaction is already playing

  if (reactionTimer) clearTimeout(reactionTimer);
  reaction = state;
  notify();
  reactionTimer = setTimeout(() => {
    reaction = null;
    reactionTimer = null;
    notify();
  }, REACTION_MS[state]);
}
