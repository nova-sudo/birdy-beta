import { cva } from "class-variance-authority"

/**
 * The field and trigger heights follow the Button's: a trigger sitting beside a Button of the same
 * size lines up with it exactly, top, bottom and corners.
 */
export const FIELD_SIZES = {
  sm: "h-8 rounded-control-sm px-3 text-sm",
  md: "h-10 rounded-control px-3.5 text-base",
  lg: "h-12 rounded-control-lg px-4 text-base",
}

// A field is a white surface on the outline button's ring and lift. The ring is a shadow, not a
// border, so hover, focus and error change it without the box moving a pixel.
const FIELD_SURFACE =
  "bg-raised text-foreground shadow-control outline-none tabular-nums transition-[background-color,box-shadow,color,translate,scale] duration-160 ease-press placeholder:text-muted-foreground hover:bg-raised-hover hover:shadow-control-hover aria-invalid:shadow-field-error data-[warning=true]:shadow-field-warning data-[warning=true]:hover:shadow-field-warning disabled:cursor-not-allowed disabled:bg-field-disabled disabled:text-field-disabled-foreground disabled:shadow-field-disabled disabled:placeholder:text-field-disabled-foreground"

export const fieldVariants = cva(
  [
    FIELD_SURFACE,
    "w-full min-w-0 focus-visible:bg-raised focus-visible:shadow-focus-field aria-invalid:focus-visible:shadow-field-error data-[warning=true]:focus-visible:shadow-focus-field",
    "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
    "selection:bg-primary selection:text-primary-foreground",
  ],
  {
    variants: { size: FIELD_SIZES },
    defaultVariants: { size: "md" },
  }
)

/**
 * Select, menu, combobox, date and filter triggers: the field surface, pressed like a Button. The
 * open state keeps the focus ring so the trigger reads as attached to the list it opened.
 */
export const triggerVariants = cva(
  [
    FIELD_SURFACE,
    "inline-flex cursor-pointer items-center justify-between gap-2 text-left whitespace-nowrap select-none",
    "focus-visible:shadow-focus-field data-[state=open]:shadow-focus-field aria-expanded:shadow-focus-field",
    "motion-safe:active:translate-y-[1.5px] motion-safe:active:scale-[0.98] motion-safe:active:duration-90 active:bg-raised-held active:shadow-control-held",
    "data-[placeholder]:text-muted-foreground disabled:pointer-events-none",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px] [&_svg:not([class*='text-'])]:text-muted-foreground",
  ],
  {
    variants: {
      size: {
        sm: "h-8 rounded-control-sm pr-2 pl-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        md: "h-10 rounded-control pr-2.5 pl-3.5 text-base",
        lg: "h-12 rounded-control-lg pr-3 pl-4 text-base",
      },
    },
    defaultVariants: { size: "md" },
  }
)
