// The choices on Settings › Account and the Slack report's schedule.

/** Short and ordered by likelihood: the agencies on Birdy bill in a handful of currencies. */
export const CURRENCIES = [
  { code: "GBP", label: "GBP (£)" },
  { code: "USD", label: "USD ($)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "AED", label: "AED" },
  { code: "CAD", label: "CAD ($)" },
  { code: "AUD", label: "AUD ($)" },
];

/** The common zones; whatever the account already has is added by `withCurrent`. */
export const TIMEZONES = [
  "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Australia/Sydney", "UTC",
];

export const BRIEF_TIMES = ["6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "12:00 PM", "5:00 PM"];
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** The list with the current value first when it is not already in it, so a value set elsewhere stays selectable. */
export const withCurrent = (list, current) => (current && !list.includes(current) ? [current, ...list] : list);
