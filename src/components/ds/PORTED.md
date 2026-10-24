# Ported from Bytes

Source: `apps/dashboard/src/components/` at `aaefe2dd08` (read-only reference kit).
Common to every row: TS to JS with JSDoc props, `cn` from `@/lib/utils`, lucide icons, token utilities only, `data-ds` on the root.

| File | Source @ aaefe2dd08 | Stripped | Local changes |
| --- | --- | --- | --- |
| primitives/button.jsx | ui/button.tsx | auth gate prop and wrapper, Next Link href handling, icon/effect/badge props, ten extra variants and sizes, remix icons | Bytes cva structure kept. Variants primary/outline/ghost/secondary/destructive/link (primary replaces Bytes `default`, no alias). Sizes sm/md/lg/icon-sm/icon on control heights. CSS press (90ms down, 160ms ease-press release). `loading` overlays a spinner and sets aria-busy. `asChild` via Radix Slot |
| primitives/input.jsx | ui/input.tsx | none | Control height and `shadow-control`, focus `shadow-control-focus`, invalid ring in danger. API unchanged |
| primitives/textarea.jsx | ui/textarea.tsx | none | Same re-skin as input. API unchanged |
| primitives/select.jsx | ui/select.tsx | remix icons, `description` prop on SelectItem | Lucide icons. `size` default/sm maps to control heights. Content uses `shadow-floating`. Same export names as `components/ui/select` |
| primitives/checkbox.jsx | ui/checkbox.tsx | remix icons, framer-motion check animation | Lucide check. Primary fill when checked, `shadow-control` ring |
| primitives/switch.jsx | ui/switch.tsx | none | Primary track when on, border-colour track when off, `shadow-control` thumb |
| primitives/label.jsx | ui/label.tsx | none | Token colours only |
| primitives/badge.jsx | ui/badge.tsx | auth gate, tooltip prop, asChild, 20 status-named variants | Replaced by `tone` (neutral/primary/success/warning/danger/info) x `variant` (soft/dot). Soft is `-soft` fill with `-ink` text |
| primitives/tabs.jsx | ui/tabs.tsx | none (Bytes file is the Radix wrapper) | Underline style: hairline list, primary bar on active trigger. Same four exports |
| primitives/segmented-tabs.jsx | composed/segmented-tabs.tsx | tooltip per option, remix info icon, `badge` string | Rebuilt: muted track, white `shadow-control` thumb sliding via framer-motion `layoutId` spring (damping 22, stiffness 260). Props `value/onValueChange/items[{value,label,count}]/size` replace `value/onChange/options` |
| primitives/kbd.jsx | ui/coss/kbd.tsx | none | `rounded-sm`, token colours. Exports Kbd and KbdGroup |
