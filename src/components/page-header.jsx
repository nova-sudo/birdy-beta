"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

// ─── The top bar's page slot ────────────────────────────────────────────────
// Lets a route put its own title and its own filter controls into the global
// header, in place of the Birdy wordmark and beside the bell and profile menu.
//
// The header is rendered by src/app/layout.jsx and the page is its child, so a
// page cannot reach the bar above it. A context carries the pieces upward: the
// page publishes, the header renders whatever the current page published, and
// falls back to the wordmark when nothing has.
//
// **What is published are React nodes, not values.** That is the point — the
// controls stay part of the page's own tree, closing over the page's state, so
// nothing has to be lifted into a provider to be filtered by. `/dashboard`
// predates this and does it the other way round (its state lives in
// DashboardControlsProvider and the header renders fixed controls behind a
// route check); this is the version that generalises, and the Marketing Hub —
// the same screen with different data — will want it too.
//
// The one discipline it asks of a caller: memoise. A fresh object every render
// would republish every render, and publishing sets state on the provider. See
// usePageHeader.

const PageHeaderContext = createContext(null);

export function PageHeaderProvider({ children }) {
  const [slot, setSlot] = useState(null);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);

  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

/**
 * Publish this page's header content for as long as the page is mounted.
 *
 * Pass a memoised object — `useMemo`'d on whatever the title and controls
 * actually depend on. An unmemoised one changes identity on every render, which
 * republishes on every render, which re-renders the provider, which renders the
 * page again.
 *
 * Unmounting clears the slot, so navigating away restores the wordmark without
 * the next route having to know it was replaced.
 *
 * @param {{title: React.ReactNode, controls?: React.ReactNode}|null} content
 */
export function usePageHeader(content) {
  const ctx = useContext(PageHeaderContext);
  const setSlot = ctx?.setSlot;

  useEffect(() => {
    if (!setSlot) return;
    setSlot(content);
    return () => setSlot(null);
  }, [content, setSlot]);
}

/** What the current page put where the wordmark goes, or nothing. */
export function PageHeaderTitle() {
  const ctx = useContext(PageHeaderContext);
  return ctx?.slot?.title ?? null;
}

/** What the current page put beside the bell and profile menu, or nothing. */
export function PageHeaderControls() {
  const ctx = useContext(PageHeaderContext);
  return ctx?.slot?.controls ?? null;
}

/** Whether a page has claimed the slot — the wordmark reads this to stand down. */
export function useHasPageHeader() {
  const ctx = useContext(PageHeaderContext);
  return Boolean(ctx?.slot?.title);
}
