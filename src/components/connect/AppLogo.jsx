// components/connect/AppLogo.jsx
// The coloured tile for an AI app (Claude, ChatGPT, Cursor...). Shared by the
// Settings connections list and the consent page so both show the same logo.

const APP_LOGOS = [
  { match: /claude/i, text: "C", bg: "#D97757" },
  { match: /chatgpt|openai/i, text: "G", bg: "#10A37F" },
  { match: /cursor/i, text: "Cu", bg: "#18181B" },
]

const SIZES = {
  sm: "size-[26px] rounded-[7px] text-[11px]",
  lg: "size-14 rounded-[14px] text-xl",
}

export default function AppLogo({ name, size = "sm" }) {
  const known = APP_LOGOS.find((l) => l.match.test(name || ""))
  const text = known?.text || (name || "?").trim().charAt(0).toUpperCase() || "?"
  return (
    <span
      aria-hidden="true"
      className={`grid flex-none place-items-center font-bold text-white ${SIZES[size] || SIZES.sm}`}
      style={{ background: known?.bg || "#3a3a40" }}
    >
      {text}
    </span>
  )
}
