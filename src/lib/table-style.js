// The one "comfortable" table style.
//
// Every table in the app reads its measurements from here: the classic
// StyledTable (components/ui/table-container.jsx), the kit table
// (components/by/table.jsx), the ds DataTable and the few tables drawn by
// hand. They used to each carry their own numbers and drifted apart (44px
// zebra rows in one place, 48px bordered rows in another, 60px in a third).
// Change a number here and every table moves together.
//
//   single-line row  48px      two-line row (name + a line under it)  60px
//   header row       44px      cell padding                           20px either side
//   header text      12px, semibold, uppercase, 0.05em tracking, muted grey, on the canvas grey
//   body text        14px regular, secondary ink; the name column semibold in full ink
//   numbers          right-aligned, tabular figures
//   separator        a 1px soft rule under each row; no zebra
//   hover            the whole row turns one grey at once, no fade, pinned cells included
//   card             12px radius, 1px line, the card shadow, white
//
// Classes are written out in full (not built from pieces) so Tailwind sees them.
// Sizes are pixels, not rems or the kit's text-by-* names: the app's root font
// is 15.5px and text-xs is overridden to 13px, so h-12 came out at 46.5px and
// text-xs at 13px. Pixels are what the numbers above say. text-sm is 14px here.
// Every tailwind-merge in the app reads text-sm / text-[12px] as sizes.

/** Pixel values, for the places that need a number (sticky offsets, skeleton sizes). */
export const TABLE_ROW_HEIGHT = 48;
export const TABLE_ROW_HEIGHT_TALL = 60;
export const TABLE_HEAD_HEIGHT = 44;
export const TABLE_CELL_PAD_X = 20;

/** The row hover colour, as a CSS value. Opaque, so a sticky cell can wear it too. */
export const TABLE_HOVER_BG = "var(--by-grey-75)";
/** The selected-row colour, as a CSS value. */
export const TABLE_SELECTED_BG = "var(--by-accent-soft)";

/** Row height for a single-line row and for a row with a second line under its name. */
export const TABLE_ROW_H = "h-[48px]";
export const TABLE_ROW_H_TALL = "h-[60px]";

/** Horizontal cell padding. */
export const TABLE_PAD_X = "px-[20px]";

/** The header row: height, type and background. Pair with TABLE_PAD_X. */
export const TABLE_HEAD_ROW = "h-[44px]";
export const TABLE_HEAD_TEXT = "text-[12px] font-semibold uppercase tracking-[0.05em] text-by-muted";
export const TABLE_HEAD_BG = "bg-by-canvas";
/** The rule under the header, drawn as an inset shadow so it travels with a sticky header. */
export const TABLE_HEAD_RULE = "shadow-[inset_0_-1px_0_var(--by-line)]";
/** A header cell without its padding, for a cell that pads its own content. */
export const TABLE_HEAD_CELL = `${TABLE_HEAD_ROW} ${TABLE_HEAD_BG} ${TABLE_HEAD_TEXT} ${TABLE_HEAD_RULE} text-left align-middle whitespace-nowrap`;
/** A whole header cell. */
export const TABLE_TH = `${TABLE_HEAD_CELL} ${TABLE_PAD_X}`;

/** Body text, and the heavier treatment the name column takes. */
export const TABLE_BODY_TEXT = "text-sm font-normal text-by-text-2";
export const TABLE_NAME_TEXT = "text-sm font-semibold text-by-text";
/** Second line under a name. */
export const TABLE_SUB_TEXT = "text-[12px] font-normal text-by-muted";
/** A figure column. */
export const TABLE_NUM = "text-right tabular-nums";

/** The rule under every body row. */
export const TABLE_ROW_RULE = "border-b border-by-line-soft";
/**
 * The same rule as a CSS box-shadow, for a table with pinned (sticky) cells: a
 * collapsed border stays on the grid while a sticky cell slides over it, so
 * those tables draw the rule inside every cell instead.
 */
export const TABLE_ROW_RULE_SHADOW = "inset 0 -1px 0 var(--by-line-soft)";
/** A whole body cell. */
export const TABLE_TD = `${TABLE_ROW_H} ${TABLE_PAD_X} ${TABLE_ROW_RULE} ${TABLE_BODY_TEXT} align-middle`;

/**
 * Hover, on the row: every cell takes the same colour at the same instant.
 * The colour goes on the cells (not the row) so pinned cells, which paint
 * their own opaque background, change with the rest. No transition, on
 * purpose: a fade on some cells and not others was what made the row tear.
 */
export const TABLE_ROW_HOVER = "cursor-pointer [&:hover>td]:bg-(--by-grey-75)";

/** The card a table sits in. */
export const TABLE_CARD = "rounded-by-lg border border-by-line bg-by-surface shadow-by-card";
