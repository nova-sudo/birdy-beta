## 2025-05-15 - [Marketing Dashboard Parallelization]
**Learning:** Sequential API fetches in React `useEffect` are a major bottleneck for dashboards that rely on multiple data sources. Combined with redundant `localStorage` reads in data processing loops, this can significantly degrade UI responsiveness.
**Action:** Always parallelize independent fetches using `Promise.all` and lift expensive computation/reads (like `loadCustomMetrics`) out of loops and pass them as parameters.
