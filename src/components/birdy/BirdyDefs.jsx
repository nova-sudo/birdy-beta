import { BIRDY_DEFS_MARKUP } from "./birdy-defs-markup";

/**
 * Shared Birdy mascot artwork (gradients, clipPaths, reusable groups).
 * Render exactly once, high in the tree — every <Birdy> instance on the
 * page references these ids via <use href="#...">, so N birds cost one
 * copy of the artwork.
 */
export default function BirdyDefs() {
  return <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: BIRDY_DEFS_MARKUP }} />;
}
