## 2025-05-14 - [Incomplete theme variables in Radix components]
**Learning:** Some Radix-based UI components (like `SelectContent`) in this repository may not render correctly due to incomplete theme variable definitions (e.g., `bg-popover`).
**Action:** When using library components, verify their visual state in the specific page context. If they appear transparent or incorrectly styled, apply local background and border overrides (e.g., `bg-white border-gray-200`) instead of modifying the global component to avoid side effects in other parts of the application.
