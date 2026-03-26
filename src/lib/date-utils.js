import {
  format,
  subDays,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns"

/**
 * Convert a preset key into { start_date, end_date } strings (yyyy-MM-dd).
 * Returns { start_date: null, end_date: null } for "maximum" (all-time).
 */
export function presetToDateRange(preset) {
  const today = new Date()
  const fmt = (d) => format(d, "yyyy-MM-dd")

  switch (preset) {
    case "maximum":
      return { start_date: null, end_date: null }
    case "today":
      return { start_date: fmt(today), end_date: fmt(today) }
    case "yesterday": {
      const y = subDays(today, 1)
      return { start_date: fmt(y), end_date: fmt(y) }
    }
    case "this_week_mon_today":
      return {
        start_date: fmt(startOfWeek(today, { weekStartsOn: 1 })),
        end_date: fmt(today),
      }
    case "last_7d":
      return { start_date: fmt(subDays(today, 7)), end_date: fmt(today) }
    case "last_14d":
      return { start_date: fmt(subDays(today, 14)), end_date: fmt(today) }
    case "last_30d":
      return { start_date: fmt(subDays(today, 30)), end_date: fmt(today) }
    case "this_month":
      return { start_date: fmt(startOfMonth(today)), end_date: fmt(today) }
    case "last_month": {
      const lm = subMonths(today, 1)
      return { start_date: fmt(startOfMonth(lm)), end_date: fmt(endOfMonth(lm)) }
    }
    case "this_quarter":
      return { start_date: fmt(startOfQuarter(today)), end_date: fmt(today) }
    case "last_quarter": {
      const lq = subQuarters(today, 1)
      return { start_date: fmt(startOfQuarter(lq)), end_date: fmt(endOfQuarter(lq)) }
    }
    case "this_year":
      return { start_date: fmt(startOfYear(today)), end_date: fmt(today) }
    case "last_year": {
      const ly = subYears(today, 1)
      return { start_date: fmt(startOfYear(ly)), end_date: fmt(endOfYear(ly)) }
    }
    default:
      return { start_date: null, end_date: null }
  }
}

/**
 * Convert a preset key into { start, end } strings (yyyy-MM-dd).
 * Alternate format used by campaigns page.
 */
export function presetToStartEnd(preset) {
  const { start_date, end_date } = presetToDateRange(preset)
  if (start_date === null) {
    const today = new Date()
    return { start: "2010-01-01", end: format(today, "yyyy-MM-dd") }
  }
  return { start: start_date, end: end_date }
}
