# Design memory

Distilled from the ProgressPanel redesign exploration (July 2026, nine rounds
in a temporary design lab). Guidance for future design work on Yalla Flash.

## Direction that won: "the fold"

- **The words themselves are the visual.** Abstract metaphors lost every
  round: literal forest ("not good ux"), dot grids ("too orderly"), orbits
  ("too messy"), notebook skeuomorphism (alignment fights). The user's own
  vocabulary, typeset, beat all of them.
- **Typography encodes data**: font weight first (precise, orderable —
  Brath, *Visualizing with Text*), opacity second, blur last and capped so
  ghost text reads intentional, never broken.
- **Reading order can be the axis.** Sorting words strongest → weakest gave
  the spatial meaning of a chart without chart furniture.
- **Curate, don't sample.** Words that need attention get guaranteed slots;
  proportional sampling buries the signal at scale.

## Interaction rules learned

- Hover previews, tap acts — no intermediate "select" step. Taps send a
  prompt straight to the tutor chat.
- Grow-on-hover must use `transform: scale`, never font-weight — weight
  changes re-wrap lines. Spacing via per-item padding, not flex gap, so tap
  targets tile with no dead space.
- Hover state clears on leaving the card, not the element (so the cursor
  can travel), and everything must degrade to tap-only on touch.

## Tone

- Backlog copy is a recovery plan, not an alarm: sized in minutes, "asleep /
  wake" not "overdue/failed". Voice reference: ncase.me/remember (memory
  science, warmly) and pudding.cool (data lives in the prose).
- No SRS jargon in UI ("mean ease" is banned). Sentence case everywhere.

## Panel structure

Next action (one primary CTA sized in minutes) → slipping words → stats row.
Every element is a door into the chat tutor.

## In-situ revision (July 2026): the sidebar must whisper

The full fold won in the lab but lost in the app: 40 bold words next to a
live conversation out-shouted the chat, and the boxed gray sidebar clashed
with the page's green gradient. Rules learned:

- **The chat is the stage; the sidebar is peripheral vision.** Sidebar
  elements must be visibly quieter than the conversation. If a lab-winning
  design competes with the primary surface in situ, the context wins.
- **One canvas.** No sidebar background or border — panel content is
  chromeless type on the same gradient as the chat. Cards/borders/shadows
  are reserved for conversation objects (review widgets, the composer).
- **Only words that need the user earn sidebar space.** Strong words are
  the least useful information and were most of the ink. Show due + fading
  words (capped ~8, still tap-to-quiz); when nothing is slipping, one line:
  "All N holding strong." The strongest state of the panel is the emptiest.
- Stats are a bare row pinned to the bottom — no box, no dividers.

## Known gaps / next opportunities

- Streaks, weekly charts, and honest trend lines need a `review_log` table
  (schema only stores `updated_at` per word today).
- Native surfaces: app-icon badge for due count, home-screen widget,
  batch-aware notification timing.

---

*Updated by the design-lab process*
