"use client";

import { useSyncExternalStore } from "react";
import { subscribe, getBirdyState, flash, setBusy } from "./birdy-store";

/**
 * Subscribes to the app-wide Birdy mascot state.
 *   const { state, flash } = useBirdy();
 *   <Birdy state={state} />
 *   ...
 *   flash("success") // save succeeded — plays once, then back to follow/loading
 */
export function useBirdy() {
  const state = useSyncExternalStore(subscribe, getBirdyState, () => "follow");
  return { state, flash, setBusy };
}
