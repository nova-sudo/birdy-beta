import "@testing-library/jest-dom/vitest"

// jsdom has no matchMedia; the mascot and framer-motion ask it about
// prefers-reduced-motion. Answer "no preference" everywhere.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
