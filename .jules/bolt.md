## 2025-05-14 - Optimize Custom Metrics Processing in Campaigns Hub
**Learning:** Operations involving `localStorage` access or expensive JSON parsing (like `loadCustomMetrics`) should be lifted out of data processing loops. In `Campaigns Hub`, calling `loadCustomMetrics` inside a `.map()` loop for hundreds of campaigns, adsets, and ads was causing significant overhead due to redundant disk/memory access and string parsing.
**Action:** Lift `loadCustomMetrics` out of loops and pass the pre-loaded data as a parameter to the processing functions.
