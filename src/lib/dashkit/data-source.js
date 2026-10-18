import { createFetchDataSource } from "dashkit/adapters"
import { DASHKIT_BASE_URL, dashkitFetch } from "./fetch"

/** The most bindings POST /api/dashboards/resolve accepts in one request (422 above). */
export const RESOLVE_CHUNK_SIZE = 50

/**
 * Splits every resolve into requests of at most `chunkSize` bindings, sent in
 * parallel, and joins their slots back in order.
 *
 * dashkit's data provider sends every binding queued in one tick as a single
 * batch, so a large dashboard would exceed the backend's limit and every
 * widget would show the 422. When one chunk fails, its bindings resolve to
 * `null` (each of those widgets shows "no data" on its own) and the other
 * chunks still render. Only when every chunk fails does resolve reject, with
 * the first error, so a whole-request failure (offline, signed out) keeps its
 * real message, as dashkit's DataSource contract asks.
 *
 * @param {import("dashkit/adapters").DataSource} source
 * @param {number} [chunkSize]
 * @returns {import("dashkit/adapters").DataSource}
 */
export function chunkedDataSource(source, chunkSize = RESOLVE_CHUNK_SIZE) {
  return {
    catalog: () => source.catalog(),
    async resolve(bindings, shapes) {
      if (bindings.length <= chunkSize) return source.resolve(bindings, shapes)

      const ranges = []
      for (let start = 0; start < bindings.length; start += chunkSize) {
        ranges.push([start, Math.min(start + chunkSize, bindings.length)])
      }
      const results = await Promise.allSettled(
        ranges.map(([start, end]) => source.resolve(bindings.slice(start, end), shapes?.slice(start, end))),
      )
      const failed = results.filter((r) => r.status === "rejected")
      if (failed.length === results.length) throw failed[0].reason

      return results.flatMap((result, i) => {
        const [start, end] = ranges[i]
        const size = end - start
        if (result.status === "rejected") return Array(size).fill(null)
        // A short answer must not shift the next chunk's slots onto the wrong widgets.
        return Array.from({ length: size }, (_, j) => result.value?.[j] ?? null)
      })
    },
  }
}

/** Metric catalog and binding resolution: /api/dashboards/catalog and /resolve. */
export const dataSource = chunkedDataSource(createFetchDataSource(DASHKIT_BASE_URL, dashkitFetch))
