// Transition recipes shared by the kit's controls.
//
// One `transition` cannot give colour and movement different timings through
// Tailwind's single duration/ease utilities, so the pairs are written out:
// colour changes are fast on the ease-out curve, movement is slower on the
// spring. Movement itself is applied with `motion-safe:` at the call site, so
// under "reduce motion" only the colour fades remain.

const COLOUR = ["background-color", "border-color", "color", "box-shadow", "outline-color"]
  .map((p) => `${p}_var(--by-dur-fast)_var(--by-ease-out)`)
  .join(",");

/** Colour fades plus a springy transform, for anything that lifts or presses. */
export const LIFT_TRANSITION = `[transition:${COLOUR},transform_var(--by-dur-press)_var(--by-ease-spring)]`;

/** Lift a pixel on hover, squash slightly on press. */
export const LIFT = `${LIFT_TRANSITION} motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 motion-safe:active:scale-95`;

/** The 2px accent outline every focusable control shows for keyboard focus. */
// No `outline-none` here: in Tailwind v4 it sets the outline style to none,
// which would also cancel the focus-visible outline below.
export const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent";
