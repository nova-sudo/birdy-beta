import { createFetchDataSource } from "dashkit/adapters"
import { DASHKIT_BASE_URL, dashkitFetch } from "./fetch"

/** The most queries POST /api/dashboards/query accepts in one request (422 above). */
export const QUERY_CHUNK_SIZE = 50

/**
 * Splits every query call into requests of at most `chunkSize` queries, sent
 * in parallel, and joins their frames back in order.
 *
 * dashkit's data provider sends every query queued in one tick as a single
 * batch, so a large dashboard would exceed the backend's limit and every
 * widget would show the 422. When one chunk fails, its queries get a `null`
 * frame, which dashkit renders as that widget's error state ("Data source
 * returned no data for this query"), and the other chunks still render. Only
 * when every chunk fails does query reject, with the first error, so a
 * whole-request failure (offline, signed out) keeps its real message, as
 * dashkit's DataSource contract asks.
 *
 * @param {import("dashkit/adapters").DataSource} source
 * @param {number} [chunkSize]
 * @returns {import("dashkit/adapters").DataSource}
 */
export function chunkedDataSource(source, chunkSize = QUERY_CHUNK_SIZE) {
  return {
    catalog: () => source.catalog(),
    async query(queries) {
      if (queries.length <= chunkSize) return source.query(queries)

      const ranges = []
      for (let start = 0; start < queries.length; start += chunkSize) {
        ranges.push([start, Math.min(start + chunkSize, queries.length)])
      }
      const results = await Promise.allSettled(ranges.map(([start, end]) => source.query(queries.slice(start, end))))
      const failed = results.filter((r) => r.status === "rejected")
      if (failed.length === results.length) throw failed[0].reason

      return results.flatMap((result, i) => {
        const [start, end] = ranges[i]
        const size = end - start
        if (result.status === "rejected") return Array(size).fill(null)
        // A short answer must not shift the next chunk's frames onto the wrong widgets.
        return Array.from({ length: size }, (_, j) => result.value?.[j] ?? null)
      })
    },
  }
}

/** Metric catalog and widget data: /api/dashboards/catalog and /query. */
export const dataSource = chunkedDataSource(createFetchDataSource(DASHKIT_BASE_URL, dashkitFetch))
