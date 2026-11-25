// What each Marketing Guru rule says, as a title and a sentence with slots for its
// numbers. Shared by the playbook editor (components/agents/PlaybookRule) and
// the setup interview, which shows the drafted rules as plain sentences.
//
// A part is either text or a param slot: `{ key, label, money?, suffix? }`.
export const RULE_WORDS = {
  pause_over_target: {
    title: "Pause ads over target",
    parts: [
      "After ",
      { key: "patience_spend", label: "Spend before judging", money: true },
      " or ",
      { key: "patience_days", label: "Days before judging", suffix: "days" },
      ", CPL over ",
      { key: "cpl_multiple", label: "CPL multiple of target", suffix: "×", step: "0.1" },
      " target, or 0 leads after ",
      { key: "zero_lead_spend", label: "Spend with no leads", money: true },
      ".",
    ],
  },
  revive_winner: {
    title: "Revive old winners",
    parts: [
      "After ",
      { key: "min_paused_days", label: "Days paused", suffix: "days" },
      " off, if it beat target, creative under ",
      { key: "max_creative_age_days", label: "Max creative age in days", suffix: "days" },
      " old.",
    ],
  },
  flag_no_spend: {
    title: "Flag no spend",
    parts: ["Live ad set with no spend for ", { key: "hours", label: "Hours with no spend", suffix: "hrs" }, "."],
  },
  flag_declining: {
    title: "Flag declining performance",
    parts: [
      "CPL up ",
      { key: "pct_rise", label: "CPL rise percent", suffix: "%" },
      " week on week, with at least ",
      { key: "min_leads", label: "Minimum leads", suffix: "leads" },
      ".",
    ],
  },
}

function slotValue(value, part, currency) {
  if (value == null || value === "") return "—"
  if (part.money) return `${currency}${value}`
  if (part.suffix === "×" || part.suffix === "%") return `${value}${part.suffix}`
  return part.suffix ? `${value} ${part.suffix}` : String(value)
}

/** One rule as a sentence: "Pause ads over target: After £60 or 3 days, …". Unknown kinds read as their key. */
export function ruleSentence(rule, currency = "$") {
  const words = RULE_WORDS[rule?.kind]
  if (!words) return String(rule?.kind ?? "").replace(/_/g, " ")
  const body = words.parts.map((p) => (typeof p === "string" ? p : slotValue(rule.params?.[p.key], p, currency))).join("").trim()
  return `${words.title}: ${body}`
}

/** The rules a playbook block carries: a list, or `{rules}`. Switched-off rules are left out. */
export function playbookRules(playbook) {
  const rules = Array.isArray(playbook) ? playbook : Array.isArray(playbook?.rules) ? playbook.rules : []
  return rules.filter((r) => r && r.enabled !== false)
}
