import { createFetchStore } from "dashkit/adapters"
import { DASHKIT_BASE_URL, dashkitFetch } from "./fetch"

/** Saved dashboards: GET/PUT/DELETE /api/dashboards[/:id]. */
export const store = createFetchStore(DASHKIT_BASE_URL, dashkitFetch)
