// Global Birdy state — a plain external store (no React context needed) so
// non-component code (src/lib/api.js) can drive the mascot the same way
// components do, via `setBusy` / `flash` imported directly.
//
// `follow` is the default. `loading` holds for as long as any request is in
// flight (ref-counted). The seven reactions replace whatever is showing for
// one cycle, then fall back — see design_handoff_birdy_animations/README.md.
//
// `peek` doubles as idle personality on top of that: whenever a loading
// spell or another reaction finishes and there's nothing higher-priority to
// take over, the bird peeks once before settling into follow instead of
// snapping straight to it — see settle(). And if it sits in plain follow
// with nothing happening for 5s, it peeks again on its own — see
// armIdleTimer(). Entering `loading` never peeks first; that cue has to
// stay immediate.

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
let idleTimer = null;
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

function clearIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}

// 5s of sitting in plain follow with nothing happening — peek once, purely
// as idle personality. Re-armed every time the bird settles back into
// follow (see settle()), so it keeps doing this for as long as it's left
// alone.
function armIdleTimer() {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (computeState() === "follow") flash("peek");
  }, 5000);
}

// Called right after busyCount or reaction changes. If that landed us on
// plain follow, either peek first (something other than peek just finished
// — a loading spell or a reaction) or arm the idle timer (peek itself just
// finished, or we were already idle). Otherwise just make sure no stale
// idle timer is left running.
function settle(previousState) {
  if (computeState() !== "follow") {
    clearIdleTimer();
    return;
  }
  if (previousState && previousState !== "follow" && previousState !== "peek") {
    flash("peek");
  } else {
    armIdleTimer();
  }
}

/** Ref-counted: pair every setBusy(true) with a setBusy(false). */
export function setBusy(active) {
  const next = Math.max(0, busyCount + (active ? 1 : -1));
  if (next === busyCount) return;
  const previousState = computeState();
  busyCount = next;
  notify();
  settle(previousState);
}

/** Show `state` for one cycle, then settle back toward loading/follow. */
export function flash(state) {
  if (!(state in REACTION_MS)) return;
  if (reaction && RANK[reaction] < RANK[state]) return; // a higher-priority reaction is already playing

  if (reactionTimer) clearTimeout(reactionTimer);
  clearIdleTimer();
  reaction = state;
  notify();
  reactionTimer = setTimeout(() => {
    const previousState = reaction;
    reaction = null;
    reactionTimer = null;
    notify();
    settle(previousState);
  }, REACTION_MS[state]);
}

// Idle from the very start — arm the first 5s idle-peek window. Guarded
// since this module can be evaluated during SSR, where there's no client
// to ever see the timer fire.
if (typeof window !== "undefined") armIdleTimer();
