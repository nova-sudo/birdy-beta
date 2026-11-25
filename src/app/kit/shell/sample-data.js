// Sample data for the shell preview, taken from the redesign's fixtures.
// Nothing here talks to the API.

export const CLIENTS = [
  { id: "aura", name: "Aura", status: "danger" },
  { id: "autumn-rose", name: "Autumn Rose Hair & Beauty", status: "success" },
  { id: "bbl-body", name: "Bbl Body Confidence", status: "success" },
  { id: "bbl-bromley", name: "Bbl Bromley (Lymphatic Sculpt)", status: "success" },
  { id: "beaulea", name: "Beaulea Clinic", status: "danger" },
  { id: "beauty-hub", name: "Beauty Hub MCR", status: "danger" },
  { id: "casey", name: "Casey Beauty & Aesthetics", status: "success" },
  { id: "cloud-nine", name: "Cloud Nine Beauty", status: "warning" },
  { id: "fallon", name: "Fallon Physique", status: "warning" },
  { id: "filthy", name: "Filthy Gorgeous Beauty & Aesthetics by Georgina", status: "success" },
  { id: "healthy-glow", name: "Healthy Glow", status: "success" },
  { id: "lizzie", name: "Lizzie Jayne’s Beauty", status: "success" },
  { id: "sculpt-glow", name: "Sculpt & Glow Studio", status: "warning" },
  { id: "thee-vision", name: "Thee Vision Studio", status: "success" },
];

export const STATUS_LABEL = { danger: "At risk", warning: "At risk", success: "On track" };

// Marketing Guru's Dashboard rows: client, leads, CPL tone, CPL, ad spend, Birdy pill.
export const ROWS = [
  ["Plush Aesthetics", 13, "success", 4.67, 60.71, ["danger", "Ads stopped"]],
  ["Cloud Nine Beauty", 19, "danger", 5.9, 112.15, ["accent", "2 changes"]],
  ["Aura", 4, "danger", 12.46, 49.86, ["accent", "3 changes"]],
  ["Fallon Physique", 17, "danger", 5.03, 85.54, ["accent", "1 change"]],
  ["Sculpted By Hayley", 13, "warning", 3.62, 47.02, ["accent", "2 changes"]],
  ["The Cosmetic Clinic MCR", 24, "warning", 2.87, 68.88, ["accent", "2 changes"]],
  ["Skin Beautiful", 34, "warning", 3.36, 114.35, ["accent", "2 changes"]],
];

export const TABS = [
  { value: "chat", label: "Chat" },
  { value: "birds-eye", label: "Bird’s Eye" },
  { value: "dashboard", label: "Dashboard" },
  { value: "suggestions", label: "Suggestions", count: 8 },
];

export const COUNTS = { ops: 5, buyer: 8, coach: 3, clients: 0 };
