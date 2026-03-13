## 2026-03-13 - Parallelized Data Fetches & Optimized Metric Processing
**Learning:** Sequential network requests create waterfalls that significantly delay Time to Interactive (TTI). Repeatedly accessing `localStorage` and parsing JSON in data processing loops (`O(N)`) adds unnecessary overhead to the main thread.
**Action:** Parallelize independent network requests using `Promise.all`. Lift expensive I/O and parsing operations (`loadCustomMetrics`) out of loops and pass them as parameters.
