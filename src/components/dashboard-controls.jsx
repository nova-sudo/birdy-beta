"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { DEFAULT_DATE_PRESET } from "@/lib/constants";

// The dashboard's date range is held above the page, in the app shell, so it
// survives navigating away and back. The control that changes it is the
// period switch in the dashboard's own page header; the page reads the same
// value.

const DashboardControlsContext = createContext(null);

export function DashboardControlsProvider({ children }) {
  const [preset, setPreset] = useState(DEFAULT_DATE_PRESET);
  const value = useMemo(() => ({ preset, setPreset }), [preset]);

  return (
    <DashboardControlsContext.Provider value={value}>
      {children}
    </DashboardControlsContext.Provider>
  );
}

/**
 * Read the shared dashboard date range.
 *
 * Falls back to a local default when no provider is above, so the dashboard
 * renders something sensible in tests and anywhere else it's mounted
 * standalone.
 */
export function useDashboardControls() {
  const ctx = useContext(DashboardControlsContext);
  const [fallbackPreset, setFallbackPreset] = useState(DEFAULT_DATE_PRESET);

  return ctx ?? { preset: fallbackPreset, setPreset: setFallbackPreset };
}
