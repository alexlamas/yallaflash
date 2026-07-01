# Yalla Flash V2 — chat-native rebuild

Status: draft spec, round 1. Not implementation-ready — captures direction agreed on so far, expect this to change as we build.

## Why

Yalla Flash today is a Quizlet-style app with AI features bolted on: rigid onboarding wizard, a fixed flip-card review page, admin panel, packs marketplace. The user has switched to a Claude Project connected to a Notion vocab database for actual daily learning, because that setup is more fluid — batches of new words, conversational testing one word at a time, spaced repetition driven by a mix of a fixed schedule and human judgment, examples woven into mini-stories, root/etymology on request, explicit "I'm not sure" instead of confident hallucination.

V2's goal: rebuild Yalla Flash as a chat-native app — an AI tutor in a chat window, with flashcards/quizzes/word-add previews rendered as interactive widgets inline in the message stream, not separate pages. Start with Lebanese Arabic only; keep the architecture from hardcoding "Arabic" wherever that's cheap.

## Decisions locked in (round 1)

| Question | Decision |
|---|---|
| Evolve existing app or fresh rebuild? | **Fresh rebuild** — new schema/app structure, not a reskin of the current one |
| First deliverable | **This spec**, before any code |
| Who decides what gets tested/when | **Hybrid** — SRS algorithm is authoritative on due-set/interval math; AI controls framing, pacing, ordering within the due set |
| Infra to keep | **Cut ruthlessly** — no admin panel, no packs marketplace UI, no PostHog experiments, no AI credit throttling gate (keep the table, drop the block) |
| Confidence/interval model | **Keep existing continuous SM-2** (3 states: new/learning/learned) — not adopting a 4-tier ladder, minimal change from current algorithm |
| Grading of cold-recall answers | **Normalized string match, with LLM fallback only on close near-misses** (small edit distance) — grading stays mostly deterministic |
| User scope | **Personal use only** — no roles, no multi-tenant RLS complexity, single account |
| Packs in V1 | **Keep 1-2 minimal seeded packs** (script-seeded, no admin UI) so onboarding's "browse packs" path isn't a dead end |

## What's reused from the current codebase

- `calculateNextReview()` in `app/services/spacedRepetitionService.ts` — pure function, no DB coupling, works unchanged.
- Supabase (Postgres + Auth) as the backend.
- Claude API via `@anthropic-ai/sdk` — but moving from ad-hoc text/JSON prompts to real tool-calling. Nothing in the current app uses tool use today; this is the biggest structural change.
- The DB-driven transliteration-rules pattern (`transliterationService.ts`) — already decoupled from code, just needs a `language_id` to scope it for future languages.

## What's cut

Admin panel, admin/reviewer roles, content-review workflow, packs marketplace CRUD, PostHog experiments, AI credit throttling gate, offline sync, games (return later as widget types), the onboarding wizard (name/avatar/fluency steps), the flip-card review page.

## Data model (new schema)

- `languages` — code, name, script_direction, has_transliteration. Only `leb-ar` populated now; this is the seam for going language-agnostic later.
- `words` — language_id, arabizi (stored exactly as typed, never auto-converted), arabic_script, english, type, memory_hook, etymology_note, etymology_confidence, pack_id, user_id.
- `word_progress` — word_id, status (new/learning/learned), interval, ease_factor, review_count, next_review_date. Same shape as today.
- `conversations` / `messages` — role, text, widget_payload (jsonb), created_at. The old app had no persistent chat; this is new.
- `packs`, `pack_words` — minimal, script-seeded.

## Widget system

An assistant message carries plain text plus zero or more typed JSON blocks the frontend renders as components:

- `word_card` — arabizi, arabic script, english, memory hook
- `quiz_mc` — multiple choice
- `recall_input` — open text recall
- `produce_cold` — no options, cold Arabizi production
- `add_words_preview` — parsed word rows pending confirmation, with lettered (a/b/c) flags on assumptions — ports the Notion project's "flag assumptions before locking in" rule
- `session_summary` — end-of-review recap

Later, not V1: `game_memory`, `game_speed_match`, song-lyric widgets (the existing `SongPlayer` expandable-card pattern is the right shape to adapt).

## Hybrid SRS mechanics

Backend tools the model can call: `get_due_words`, `record_answer`, `add_words`, `search_words`, `get_word_detail`. The due set and interval math are deterministic — the model never invents scheduling. The model chooses which due word to surface first, how to frame it, what story/etymology to attach, and how to react to right/wrong answers. Grading is deterministic normalized matching, with LLM judgment only invoked on close near-misses (typos, accepted alt-spellings).

## Core flows

- **Onboarding** — first assistant message is itself a widget: "Add words" / "Browse packs." No wizard.
- **Adding words** — paste vocab in chat → AI parses → `add_words_preview` widget with flagged ambiguities → confirm → inserted as `status: new`.
- **Testing** — "test me" → `get_due_words` → one `word_card` + response-widget at a time, wait for answer before advancing → deterministic grade → `record_answer` updates status/interval → AI gives verdict + script + root/origin, mirroring the Notion setup's testing rules.

## Open before scaffolding starts

- **Where does this live?** GitHub access this session is scoped to `alexlamas/yallaflash` only. Default plan: build V2 inside this repo (new structure, old app removed/archived once V2 replaces it) rather than a separate repo, since a separate repo would need to be created by the user and isn't something this session can push to. Flagging for explicit confirmation before any destructive restructuring happens.
- Exact tool-calling schema for the Claude backend (tool names/params above are directional, not final).
- Whether `conversations`/`messages` needs multi-conversation support or a single ongoing thread is enough for personal use.
