// jsdom has no layout: every element is 0px wide. dashkit's grid (and the
// workspace's own editor-width check) measure their container with a
// ResizeObserver and render only a placeholder until a width lands, and
// recharts' ResponsiveContainer draws nothing at 0x0. This stub reports
// `gridWidth` (a desktop canvas by default) for everything observed, on
// observe(), as a real observer's first callback would.
// Imported by the dashboard tests only, so the rest of the suite keeps
// jsdom's missing ResizeObserver.

let gridWidth = 1440

/** The width every observed element reports from now on (e.g. 800 for a narrow editor). */
export function setGridWidth(width) {
  gridWidth = width
}

class FixedResizeObserver {
  constructor(callback) {
    this.callback = callback
  }

  observe(target) {
    const width = gridWidth
    const height = 900
    const contentRect = { width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height }
    this.callback([{ target, contentRect }], this)
  }

  unobserve() {}

  disconnect() {}
}

globalThis.ResizeObserver = FixedResizeObserver
