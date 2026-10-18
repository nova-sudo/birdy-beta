import { createFetchDataSource } from "dashkit/adapters"
import { DASHKIT_BASE_URL, dashkitFetch } from "./fetch"

/** Metric catalog and binding resolution: /api/dashboards/catalog and /resolve. */
export const dataSource = createFetchDataSource(DASHKIT_BASE_URL, dashkitFetch)
