"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-pd-surface group/calendar p-3 [--cell-size:--spacing(8)]",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("flex gap-4 flex-col md:flex-row relative", defaultClassNames.months),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) aria-disabled:opacity-30 p-0 select-none text-pd-primary transition-colors",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) aria-disabled:opacity-30 p-0 select-none text-pd-primary transition-colors",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex items-center justify-center h-(--cell-size) w-full px-(--cell-size) font-pd-display font-semibold text-pd-ink",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-(--cell-size) gap-1.5 text-pd-ink",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative has-focus:border-primary border border-gray-300 shadow-xs has-focus:ring-primary/15 has-focus:ring-4 rounded-full bg-background",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn("absolute bg-background inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn("select-none font-medium text-pd-ink", captionLayout === "label"
          ? "text-sm"
          : "rounded-full pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-pd-primary [&>svg]:size-3.5", defaultClassNames.caption_label),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-pd-subtle rounded-full flex-1 font-semibold text-[0.8rem] select-none uppercase",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        week_number_header: cn("select-none w-(--cell-size)", defaultClassNames.week_number_header),
        week_number: cn(
          "text-[0.8rem] select-none text-pd-subtle",
          defaultClassNames.week_number
        ),
        day: cn(
          "relative w-full h-full p-0 text-center [&:last-child[data-selected=true]]:rounded-r-full group/day aspect-square select-none",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]]:rounded-l-full"
            : "[&:first-child[data-selected=true]]:rounded-l-full",
          defaultClassNames.day
        ),
        range_start: cn("rounded-l-full bg-pd-primary-tint", defaultClassNames.range_start),
        range_middle: cn("rounded-none bg-pd-primary-tint", defaultClassNames.range_middle),
        range_end: cn("rounded-r-full bg-pd-primary-tint", defaultClassNames.range_end),
        today: cn(
          "bg-pd-primary-tint text-pd-primary rounded-full font-semibold data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        outside: cn(
          "text-pd-faint aria-selected:text-pd-faint",
          defaultClassNames.outside
        ),
        disabled: cn("text-pd-faint opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (<div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />);
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (<ChevronLeftIcon className={cn("size-4", className)} {...props} />);
          }

          if (orientation === "right") {
            return (<ChevronRightIcon className={cn("size-4", className)} {...props} />);
          }

          return (<ChevronDownIcon className={cn("size-4", className)} {...props} />);
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div
                className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props} />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[selected-single=true]:bg-pd-primary data-[selected-single=true]:text-white data-[selected-single=true]:font-semibold data-[range-middle=true]:bg-transparent data-[range-middle=true]:text-pd-primary data-[range-start=true]:bg-pd-primary data-[range-start=true]:text-white data-[range-start=true]:font-semibold data-[range-end=true]:bg-pd-primary data-[range-end=true]:text-white data-[range-end=true]:font-semibold group-data-[focused=true]/day:border-primary group-data-[focused=true]/day:ring-primary/15 hover:bg-pd-primary-tint transition-colors text-pd-ink flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-4 data-[range-end=true]:rounded-r-full data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-l-full [&>span]:text-xs [&>span]:opacity-70 rounded-full",
        defaultClassNames.day,
        className
      )}
      {...props} />
  );
}

export { Calendar, CalendarDayButton }
