// When a scheduled report next goes out, worked out from the schedule the server
// stores (a time of day, a timezone and the weekdays it runs on). Nothing here
// is a guess about the data: it is the calendar arithmetic the server's own
// scheduler does, so the page can say "Next: Tomorrow · 7:00 AM".

/** Monday first, as the server counts weekdays (Python's weekday(): 0 is Monday). */
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const JS_TO_MON_FIRST = [6, 0, 1, 2, 3, 4, 5];

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** A timezone the browser knows, else London (the server's default). */
export function safeZone(tz) {
  if (!tz) return "Europe/London";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return "Europe/London";
  }
}

/** The wall clock in `tz` at `date`: {y, m (1-12), d, weekday (0 = Monday), h, mi}. */
export function zonedParts(date, tz) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeZone(tz), year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  return { y, m, d, weekday: JS_TO_MON_FIRST[new Date(Date.UTC(y, m - 1, d)).getUTCDay()], h: Number(get("hour")) % 24, mi: Number(get("minute")) };
}

/** The instant the wall clock in `tz` reads y-m-d h:mi. */
export function zonedToUtc(y, m, d, h, mi, tz) {
  const want = Date.UTC(y, m - 1, d, h, mi);
  let guess = want;
  // Two passes settle the zone's offset, including on a clock-change day.
  for (let i = 0; i < 2; i += 1) {
    const p = zonedParts(new Date(guess), tz);
    guess += want - Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  }
  return new Date(guess);
}

/**
 * The next time a schedule goes out after `now`.
 * @param {{time: string, tz?: string, weekdays?: number[]|null}} schedule weekdays Monday-first; null or empty = every day
 * @returns {Date|null} null when the time can't be read
 */
export function nextRun({ time, tz, weekdays = null }, now = new Date()) {
  const match = TIME_RE.exec(time || "");
  if (!match) return null;
  const zone = safeZone(tz);
  const days = weekdays?.length ? weekdays : null;
  const today = zonedParts(now, zone);
  for (let i = 0; i <= 7; i += 1) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const weekday = JS_TO_MON_FIRST[day.getUTCDay()];
    if (days && !days.includes(weekday)) continue;
    const at = zonedToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), Number(match[1]), Number(match[2]), zone);
    if (at > now) return at;
  }
  return null;
}

/** "16:45" as "4:45 PM". */
export function clockWords(hhmm) {
  const match = TIME_RE.exec(hhmm || "");
  if (!match) return hhmm || "";
  const h = Number(match[1]);
  return `${h % 12 || 12}:${match[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** A day near `now`, in `tz`: "Today", "Tomorrow", "Yesterday", else "Fri 6 Nov". */
export function dayWords(date, now = new Date(), tz) {
  const zone = safeZone(tz);
  const a = zonedParts(date, zone);
  const b = zonedParts(now, zone);
  const diff = Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return `${WEEKDAY_SHORT[a.weekday]} ${a.d} ${MONTHS[a.m - 1]}`;
}

/** A moment as "Tomorrow · 7:00 AM", on the clock of `tz`. */
export function whenWords(date, now = new Date(), tz) {
  if (!date || Number.isNaN(date.getTime?.())) return "";
  const p = zonedParts(date, tz);
  return `${dayWords(date, now, tz)} · ${clockWords(`${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`)}`;
}

/** Weekdays (Monday-first numbers) as "Mon, Thu", or "Every day" for all seven. */
export function weekdaysWords(weekdays = []) {
  const days = [...new Set(weekdays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (days.length === 7) return "Every day";
  return days.map((d) => WEEKDAY_SHORT[d]).join(", ");
}

/** "Europe/London" as "London", for a schedule line. */
export const zoneCity = (tz) => String(safeZone(tz)).split("/").pop().replace(/_/g, " ");
