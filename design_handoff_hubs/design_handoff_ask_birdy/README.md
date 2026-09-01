# Handoff: Birdy — Ask Birdy (centralised)

## Overview

The centralised **Ask Birdy** page — a workspace-wide chat co-pilot, redesigned to match Birdy's current hub styling (same rail/header/card system as Marketing Hub, Sales Hub, etc). The key new capability: every conversation, and the active chat itself, is clearly scoped as either a **global workspace** conversation or a **specific client's** conversation — since Birdy previously only had this distinction on the per-client detail page's Ask Birdy tab.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes that show intended look and behaviour, not production code to copy directly. Recreate this design in the target codebase's existing environment (React, Vue, etc.) using its established component library, styling approach, and data layer.

The prototype uses a small in-house template runtime (`support.js`). Do not port that runtime — read the markup for structure/styling and the logic class for state/data shape, then rebuild idiomatically.

## Fidelity

**High-fidelity.** Colours, typography, spacing and interaction behaviour are final. `Birdy Style Guide.md` in this bundle carries the full product-wide design system for the shared rail/header chrome this page inherits.

---

## Screen: Ask Birdy

**File:** `Ask Birdy.dc.html`

**Frame:** 1600 × 1040px, `#F7F7FB` background, standard 68px icon rail + 64px header (identical to every other hub page — see Style Guide).

### Layout

Header: "Ask Birdy" title + subtitle, centred search field (searches conversations), notification bell, avatar. Below it, a two-pane content area filling the remaining height:

### 1. Conversation sidebar (fixed 280px)

- **New Chat** button (solid purple, full width) — clears the active selection and shows the empty state (see below).
- **Scope filter** — a 3-way segmented control: **All** / **Global** / **Clients**, filtering the list below.
- **Conversation list** (scrollable): each item shows a small pill badge first (🌐 **Global** in blue, or 👤 **[Client Name]** in purple), then the conversation title (truncates with ellipsis, never wraps) and a meta line (client · date · message count). The selected conversation gets a light purple background and bold/purple title. Badge and sidebar width are both hard-clipped (`overflow:hidden`, ellipsis) so a long client name can never push the sidebar wider — this was a real bug during build, worth guarding against in the rebuild too.

### 2. Chat pane (flex:1)

- **Header row**: "Chat with Birdy" (or "New conversation") + a one-line description that changes based on scope, and a **scope badge** pinned to the right — this is the second half of the global/client indicator the brief asked for. Global: blue outline pill "Global conversation". Client: purple pill "[Client] · client conversation". In the New Chat empty state, a neutral grey "Global · not saved yet" pill shows until the user actually sends a message or picks a client.
- **Message list**: user bubbles right-aligned (solid purple), bot replies left-aligned (light card, bordered). Bot replies render as **real paragraph blocks** — each paragraph is its own row with an optional bold lead-in phrase (e.g. "1. Speed to lead slipped.") followed by body text; a timestamp caption sits under bot replies. (Rendering rich text as a raw HTML string was tried and rejected — it printed literal `<br>`/`<strong>` tags — so paragraphs are structured data the template loops over, not an HTML blob.)
- **Empty state** (New Chat, no conversation selected): centred icon + "Start a new conversation" + helper copy, shown in place of the message list.
- **Composer**: single-line input area + send button; placeholder copy changes to reference the active client by name when scoped, or "the whole workspace" when global.

---

## Interactions & Behaviour

| Interaction | Behaviour |
|---|---|
| Click **New Chat** | Deselects any conversation, shows the empty state, resets the header badge to a neutral "not saved yet" pill. |
| Click a conversation row | Selects it, loads its transcript, updates the header title/subtitle/badge to match its scope (global vs that client). |
| Click a scope filter (All/Global/Clients) | Filters the sidebar list; does not change the active conversation. |
| Global vs client scoping | Drives: sidebar badge (per row), header description text, header scope badge, and the composer's placeholder — all four update together whenever the active conversation changes. |

## State Management

```
scope: 'All' | 'Global' | 'Clients'   // sidebar filter
activeIdx: number                      // id of the selected conversation
newChat: boolean                       // true when "New Chat" was clicked and nothing sent yet
```

**Data the real implementation needs:**
- Real conversation history per user, each tagged with a scope (`global` or `client:<clientId>`) — this is the core data-model requirement the brief called out: conversations need a first-class scope field, not just a title.
- Real chat transcripts wired to the actual AI backend, replacing the two mocked example transcripts (one global, one client) used here to demonstrate the pattern.
- Persisting a new conversation once the first message is sent (currently the empty "New Chat" state is UI-only, not backed by a draft record).
- Wiring the top search field to actually filter/search conversations (currently decorative, matching the pattern on other hub pages).

## Design Tokens

Inherits the full Birdy palette/type scale from `Birdy Style Guide.md`. Screen-specific:

| Token | Value | Use |
|---|---|---|
| Global badge | text `#3B7DD6`, bg `#EAF1FD` (header badge border `#D6E6FA`) | Marks a workspace-wide conversation |
| Client badge | text `#6B4EE6`, bg `#F1EEFC` (header badge border `#E3DAFB`) | Marks a client-scoped conversation |
| Neutral/unsaved badge | text `#8A8A9A`, bg `#F4F4F8`, border `#ECECF2` | New Chat, before scope is established |
| Selected conversation row | bg `#F1EEFC`, title `#4A3AA0` bold | Active item in the sidebar list |
| User bubble | solid `#6B4EE6`, white text, radius `14px 14px 4px 14px` | Right-aligned |
| Bot bubble | `#F7F7FB` bg, 1px `#ECECF2` border, radius `14px 14px 14px 4px` | Left-aligned |

## Assets

- **`uploads/birdy-mascot.png`** — rail logo, 38×38, 1px `#E3E3EC` border, 10px radius.
- **Icons** — inline SVG, Feather/Lucide-style, stroke-width 2 (globe = global, two-person glyph = client).
- **Fonts** — Poppins (headings/buttons) and Inter (body) via Google Fonts.

## Files

- **`Ask Birdy.dc.html`** — the design, ready to open standalone. **This is the reference to build from.**
- **`Birdy Style Guide.md`** — the product-wide design system for the shared rail/header chrome.
- **`support.js`** — the prototype's template runtime. Required only to open the HTML locally; **do not port it**.
- **`uploads/birdy-mascot.png`** — the mascot asset.

To view: serve the folder over HTTP (e.g. `python3 -m http.server`) and open `Ask Birdy.dc.html` — opening straight from the filesystem may block the local script and image.
