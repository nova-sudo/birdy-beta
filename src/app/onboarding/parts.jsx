"use client"

// Shared primitives for the first-run onboarding wizard. Everything here is
// presentational; state lives in page.jsx. Styling follows the onboarding
// design handoff exactly — it shares the pd-* token palette with the
// Portfolio Dashboard / Sales Hub screens (globals.css), Poppins for
// headings, Inter for body (lib/pd-fonts).

import { ArrowRight, Check, Search } from "lucide-react"

export function PrimaryButton({ children, onClick, disabled, arrow = true, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-[11px] bg-pd-primary px-[26px] py-[13px] text-[14.5px] font-semibold text-white transition-opacity hover:opacity-95 disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      {children}
      {arrow && <ArrowRight className="h-[15px] w-[15px]" strokeWidth={2.4} />}
    </button>
  )
}

export function SecondaryButton({ children, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-[11px] border border-pd-border bg-white px-[22px] py-3 text-[14px] font-semibold text-pd-body transition-colors hover:border-pd-chevron ${className}`}
    >
      {children}
    </button>
  )
}

/** 16px spinning ring — matches the prototype's obSpin spinner. */
export function SpinnerRing({ size = 16 }) {
  return (
    <div
      className="animate-spin rounded-full border-2 border-[#E4DDF9] border-t-pd-primary"
      style={{ width: size, height: size }}
    />
  )
}

/** Green check circle + label ("GHL connected", "Targets applied"…). */
export function SuccessRow({ children }) {
  return (
    <div className="mb-[22px] flex items-center justify-center gap-[9px]">
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-pd-success-bg text-pd-success">
        <Check className="h-[14px] w-[14px]" strokeWidth={3} />
      </span>
      <span className="text-[14px] font-semibold text-pd-success">{children}</span>
    </div>
  )
}

/** 56px tinted icon chip above connect-step headings. */
export function IconChip({ bg, color, children }) {
  return (
    <div
      className="mx-auto mb-[22px] flex h-14 w-14 items-center justify-center rounded-[15px]"
      style={{ background: bg, color }}
    >
      {children}
    </div>
  )
}

export function StepHeading({ children, small = false }) {
  return (
    <div
      className={`font-pd-display font-bold tracking-[-0.02em] text-pd-ink ${
        small ? "text-[19px] sm:text-[23px]" : "text-[21px] sm:text-[28px]"
      }`}
    >
      {children}
    </div>
  )
}

/** The underlined centre-aligned input unique to onboarding's name steps. */
export function UnderlineInput({ value, onChange, placeholder, autoFocus }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="mb-[30px] w-full border-0 border-b-2 border-pd-border bg-transparent px-1 py-[10px] text-center text-[17px] text-pd-ink outline-none transition-colors placeholder:text-pd-faint focus:border-pd-primary"
    />
  )
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="mb-[14px] flex h-[42px] items-center gap-[9px] rounded-[10px] border border-pd-border bg-pd-canvas px-[14px]">
      <Search className="h-[15px] w-[15px] shrink-0 text-pd-faint" strokeWidth={2} />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full flex-1 border-0 bg-transparent text-[13.5px] text-pd-ink outline-none placeholder:text-pd-faint"
      />
    </div>
  )
}

/**
 * Single-select scrollable list (clients / ad accounts / channels).
 * items: [{ id, title, sub, leading }] — leading is a ReactNode (avatar/icon).
 */
export function PickList({ items, selectedId, onPick, maxHeight = 280, emptyText = "Nothing found" }) {
  return (
    <div
      className="pd-scrolly mb-[22px] overflow-y-auto rounded-xl border border-pd-border"
      style={{ maxHeight }}
    >
      {items.length === 0 && (
        <div className="px-[14px] py-5 text-center text-[12.5px] text-pd-faint">{emptyText}</div>
      )}
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onPick(item)}
          className={`flex cursor-pointer items-center gap-[11px] border-b border-pd-row-border px-[14px] py-3 transition-colors last:border-b-0 ${
            selectedId === item.id ? "bg-pd-primary-tint" : "bg-white hover:bg-pd-canvas"
          }`}
        >
          {item.leading}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold text-pd-ink">{item.title}</div>
            {item.sub && <div className="truncate text-[11.5px] text-pd-faint">{item.sub}</div>}
          </div>
          {selectedId === item.id && (
            <Check className="h-[17px] w-[17px] shrink-0 text-pd-primary" strokeWidth={2.4} />
          )}
        </div>
      ))}
    </div>
  )
}

/** Initials avatar used by the client picker rows. */
export function InitialsAvatar({ name }) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-pd-primary-tint font-pd-display text-[11px] font-bold text-pd-primary">
      {initials}
    </div>
  )
}

/** Solid-fill Facebook glyph (brand mark — not a Lucide icon). */
export function FacebookGlyph({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
    </svg>
  )
}

/** Solid-fill Slack glyph (brand mark). */
export function SlackGlyph({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M6 15a2 2 0 1 1 0-4h2v2a2 2 0 0 1-2 2zm0-6a2 2 0 1 1 0 4H4a2 2 0 1 1 0-4h2zm9 2a2 2 0 1 1 0 4h-2v-2a2 2 0 0 1 2-2zm0 6a2 2 0 1 1 0-4h2a2 2 0 1 1 0 4h-2zM9 6a2 2 0 1 1 4 0v2H9V6zm6 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0zM9 18a2 2 0 1 1-4 0v-2h4v2zm6 0a2 2 0 1 1-4 0v-2h4v2z" />
    </svg>
  )
}

/** Slack-style dark preview card used on the channel + brief-content steps. */
export function SlackPreviewCard({ time, children }) {
  return (
    <div className="min-h-[80px] rounded-[10px] bg-[#3F0E40] px-4 py-[14px]">
      <div className="flex gap-[9px]">
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] bg-pd-primary font-pd-display text-[13px] font-bold text-white">
          B
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-[7px]">
            <span className="text-[13px] font-bold text-white">Birdy</span>
            <span className="text-[10.5px] text-[#A9A0B0]">{time}</span>
          </div>
          <div className="mt-1 text-[12.5px] leading-relaxed text-[#E4DEE7]">{children}</div>
        </div>
      </div>
    </div>
  )
}
