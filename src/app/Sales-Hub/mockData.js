/**
 * Mock data for the Sales Hub demo. Same shape as the real
 * /api/hotprospector/leads + /members responses, so all the existing
 * tables, dialogs, columns, pagination, and search work unchanged.
 *
 * Used while the live HotProspector / GHL integration is offline.
 */

const CLIENTS = [
  { name: "BBL Body Confidence", location: "Sheffield, UK" },
  { name: "Tylaesthetics", location: "Manchester, UK" },
  { name: "Aura", location: "Birmingham, UK" },
  { name: "Plush Aesthetics", location: "London, UK" },
  { name: "The Cosmetic Clinic MCR", location: "Manchester, UK" },
  { name: "Contour Aesthetics by Abi", location: "Leeds, UK" },
  { name: "Skin Beautiful", location: "Liverpool, UK" },
  { name: "Star D Body Sculpting", location: "Bristol, UK" },
]

const FIRST_NAMES = [
  "Sarah", "Emma", "Olivia", "Sophie", "Charlotte", "Amelia", "Mia", "Isla",
  "Ava", "Grace", "Lily", "Freya", "Ella", "Poppy", "Evie", "Ivy",
  "Daisy", "Florence", "Willow", "Phoebe", "Maya", "Hannah", "Bella", "Ruby",
  "Megan", "Jade", "Lara", "Holly", "Zara", "Anna", "Lottie", "Tilly",
]
const LAST_NAMES = [
  "Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Davies", "Evans",
  "Thomas", "Roberts", "Walker", "Wright", "Robinson", "Thompson", "White", "Hughes",
  "Edwards", "Green", "Hall", "Wood", "Harris", "Clark", "Cooper", "Patel",
]
const COMPANIES = [
  "Independent", "Beauty Co.", "Glow Studio", "Aesthetic Lounge", "Self-Employed",
  "Skin Bar", "The Spa", "Beauty by Design", "Luxe Aesthetics", "—",
]
const TAGS = [
  "fb lead form submitted", "engaged - call", "1 month zombie",
  "live lead", "booked consult hp", "hp callback", "ai responded",
  "day 1 - 2nd call - hp", "call-back-hp", "ai appointment booked",
]
const CALLER_NAMES = [
  "James Holloway", "Priya Khan", "Tom Brennan", "Mia Castell",
  "Daniel Field", "Rachel Mason", "Ed Robinson",
]
const GROUPS = ["Inbound", "Outbound", "Recovery", "Booking", "Aftercare"]

// Deterministic PRNG so mock data stays consistent across reloads
function mulberry32(seed) {
  let s = seed
  return function () {
    s |= 0
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(42)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min

function pad(n) { return String(n).padStart(2, "0") }
function fakeDate(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(randInt(8, 19))}:${pad(randInt(0, 59))}:${pad(randInt(0, 59))}`
}

function makeCallLog(leadId, idx) {
  const isOutbound = rand() > 0.45
  const duration = randInt(15, 600)
  const transferred = rand() > 0.85
  return {
    caller_name: pick(CALLER_NAMES),
    call_time: fakeDate(randInt(0, 60)),
    call_status: isOutbound ? "outbound" : "inbound",
    duration,
    speed_to_lead: randInt(5, 240),
    group: pick(GROUPS),
    location_name: pick(CLIENTS).name,
    from_number: `+44 ${randInt(7000, 7999)} ${randInt(100000, 999999)}`,
    to_number: `+44 ${randInt(7000, 7999)} ${randInt(100000, 999999)}`,
    transfer: transferred,
    recording_url: rand() > 0.4 ? `https://example.com/mock-recording/${leadId}-${idx}.mp3` : null,
  }
}

function makeLead(idx) {
  const first = pick(FIRST_NAMES)
  const last = pick(LAST_NAMES)
  const client = pick(CLIENTS)
  const callsCount = rand() > 0.35 ? randInt(0, 5) : 0
  const phoneDigits = `${randInt(7000, 7999)}${String(randInt(100000, 999999)).padStart(6, "0")}`
  return {
    id: `mock-lead-${idx}`,
    client_name: client.name,
    ghl_location_name: client.location,
    ghl_location_id: `mock-loc-${client.name.split(" ")[0].toLowerCase()}`,
    first_name: first,
    last_name: last,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${idx % 17 === 0 ? "" : idx}@example.com`,
    phone: `+44${phoneDigits}`,
    mobile: phoneDigits,
    country_code: "+44",
    company: pick(COMPANIES),
    city: client.location.split(",")[0].trim(),
    state: "UK",
    tags: Array.from({ length: randInt(0, 3) }, () => pick(TAGS)),
    call_logs_count: callsCount,
    call_logs: Array.from({ length: callsCount }, (_, i) => makeCallLog(`mock-lead-${idx}`, i)),
  }
}

function makeMember(idx) {
  const first = pick(FIRST_NAMES)
  const last = pick(LAST_NAMES)
  return {
    memberId: `mock-mem-${idx}`,
    first_name: first,
    last_name: last,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@birdy.demo`,
    mobile: `+44${randInt(7000, 7999)}${String(randInt(100000, 999999)).padStart(6, "0")}`,
    inbound_phone: `+44${randInt(7000, 7999)}${String(randInt(100000, 999999)).padStart(6, "0")}`,
    phone_extension: String(randInt(101, 999)),
    member_status: rand() > 0.15 ? "Active" : "Inactive",
    title: pick(["Sales Agent", "Senior Agent", "Team Lead", "Booker"]),
    company: "Birdy Demo",
    country: "UK",
  }
}

const ALL_LEADS = Array.from({ length: 287 }, (_, i) => makeLead(i + 1))
const ALL_MEMBERS = Array.from({ length: 9 }, (_, i) => makeMember(i + 1))

const LOCATION_STATS = CLIENTS.reduce((acc, c) => {
  acc[c.name] = ALL_LEADS.filter(l => l.client_name === c.name).length
  return acc
}, {})

/**
 * Mock equivalent of `apiRequest("/api/hotprospector/leads?...&limit=...")`.
 * Returns the same shape the real endpoint did, paginated.
 */
export async function mockFetchLeads({ skip = 0, limit = 100 } = {}) {
  // Tiny artificial delay so the loading state actually shows
  await new Promise(r => setTimeout(r, 250))
  const slice = ALL_LEADS.slice(skip, skip + limit)
  const totalCalls = ALL_LEADS.reduce((s, l) => s + l.call_logs_count, 0)
  return {
    data: slice,
    meta: {
      total: ALL_LEADS.length,
      total_calls: totalCalls,
      location_stats: LOCATION_STATS,
      cache_status: "demo",
      response_time_ms: 250,
    },
  }
}

export async function mockFetchMembers() {
  await new Promise(r => setTimeout(r, 200))
  return { data: ALL_MEMBERS }
}
