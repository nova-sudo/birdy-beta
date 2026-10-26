// Third-party brand colours. The ds tokens carry Birdy's own palette; these are
// other companies' marks and must stay their own colour, so they live here
// rather than as raw hex in components.

/** Logo colours for the services Birdy connects to. */
export const BRAND_COLORS = {
  slack: "#4A154B",
  meta: "#1877F2",
}

/**
 * The Slack message preview is a replica of Slack's dark theme, so its surface
 * and accents are Slack's, not Birdy's. Components set these as CSS custom
 * properties on the preview root and read them with `bg-(--slack-surface)` etc.
 */
export const SLACK_PREVIEW = {
  surface: "#1A1D21",
  raised: "#222529",
  link: "#1D9BD1",
  code: "#E8912D",
  primary: "#007a5a",
  danger: "#e01e5a",
  flash: "#9085e9",
}

/** Categorical chart hues stepped for Slack's dark surface (see SlackChart). */
export const SLACK_CHART_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"]
/** Series 9-12 share a neutral; Slack allows 12 but only 8 hues are validated. */
export const SLACK_CHART_EXTRA = "#8b8d91"

/** Inline style that exposes SLACK_PREVIEW as `--slack-*` custom properties. */
export const SLACK_PREVIEW_VARS = Object.fromEntries(
  Object.entries(SLACK_PREVIEW).map(([key, value]) => [`--slack-${key}`, value])
)

/**
 * Silk's `color` prop is a hex string fed to a shader, so it cannot read a CSS
 * variable. This mirrors the `--color-primary` token in globals.css; keep the
 * two in step.
 */
export const BIRDY_PRIMARY = "#5B3FD6"

/** Silk's fallback `color` when a caller passes none (a neutral grey-violet). */
export const SILK_DEFAULT_COLOR = "#7B7481"

/**
 * The Birdy mascot's artwork palette (see birdy-markup.js). It is raw SVG
 * markup, so it cannot read CSS tokens; the colours are the mascot's own.
 */
export const BIRDY_ART = {
  lid: "#D658EB",
  ink: "#70127D",
  coral: "#F0694C",
  pink: "#FC60AC",
}
