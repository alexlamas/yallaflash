# Product improvement loop

Operating manual for the recurring product-improvement cycle. A scheduled
Claude session runs this playbook (weekly by default). Each cycle:
observe -> decide -> build -> propose. **Deploys always go through a PR
that Alex merges** -- merging to `main` is the approval that triggers the
Vercel deploy.

## Guardrails (non-negotiable)

1. **Never push to `main`.** Every cycle works on a fresh branch
   `loop/YYYY-MM-DD-<slug>` and ends in a PR.
2. **No database schema changes without explicit approval.** Migration
   files may be *proposed* in the PR, but never applied to the remote
   Supabase project unattended.
3. **Read-only on production data.** Supabase MCP queries are SELECTs.
   Never INSERT/UPDATE/DELETE user data.
4. **One focused improvement per cycle**, not a grab bag. Small enough to
   review on a phone.
5. **Respect the style guide** (sentence case, existing design voice: warm
   forest world + mono telemetry labels) and CLAUDE.md conventions.
6. **Tests and lint must pass** (`npx vitest run`, `npm run lint`) before
   opening the PR.
7. If the data is too thin to justify a change, say so in the report and
   ship nothing. A no-op cycle is a valid outcome.

## The cycle

### 1. Observe

Pull the week's signal (Supabase MCP, read-only):

- **Activity**: distinct users with `word_progress.updated_at` in the last
  7 days vs the prior 7; total reviews; reviews per active user.
- **Learning outcomes**: status transitions (new -> learning -> learned),
  words overdue by > 3 days (stuck words).
- **v2 adoption**: rows in v2 conversation/message tables this week.
- **Qualitative**: new rows in `feedback` (includes user emails + page).
- **AI usage**: `ai_usage` counts vs limits (are users hitting the cap?).

PostHog (once its MCP is connected to this environment): funnel
`signup_cta_clicked -> signup_completed -> onboarding_completed ->
word_reviewed`, the `hero-copy-test-exp` experiment, and the v2 event
vocabulary defined in `app/v2/lib/analytics.ts` (`v2_session_completed`,
`v2_session_rated`, `v2_word_reviewed`, ...). Until then, note in the
report that funnel data was unavailable.

### 2. Decide

Rank candidate improvements by: (impact on retention/learning) x
(confidence from data) / (effort). Prefer, in order:

1. Fixing something users hit this week (feedback, error patterns).
2. Removing friction at the weakest funnel step.
3. Strengthening what's working (double down on used features).
4. Polish/quality (only when nothing above has signal).

State the reasoning in one paragraph. If proposing a v2 change, check
`docs/v2-plan.md` for intent before redesigning something deliberate.

### 3. Build

- Branch `loop/YYYY-MM-DD-<slug>` off latest `main`.
- Use the design-engineering skills in `.claude/skills/` for UI work.
- Add/extend analytics for any new surface (a feature the loop can't see
  next week is a feature that doesn't learn).
- Run `npx vitest run` and `npm run lint`.

### 4. Propose

- Open a PR titled `Loop: <improvement>` with:
  - **What the data showed** (the numbers that motivated this).
  - **What changed and why this over the alternatives.**
  - **How we'll know it worked** (the metric to watch next cycle).
- Subscribe to PR activity; fix CI and respond to review comments.
- The PR description is also the weekly report -- even a no-op cycle opens
  no PR but the session's final summary must contain the metrics digest.

### 5. Close the loop

Next cycle starts by checking the previous cycle's PR: merged? Did its
"how we'll know" metric move? Log the verdict in the new PR under
**Last cycle follow-up**.

## Event vocabulary

Keep `app/v2/lib/analytics.ts` as the single source of truth for v2 event
names. v1 events (see CLAUDE.md): `signup_cta_clicked`, `signup_completed`,
`onboarding_completed`, `word_reviewed`.

## Standing wishlist

Maintained by Alex + accumulated cycle ideas that didn't make the cut.
Check before deciding; remove items when shipped.

- Remove the admin gate on v2 chat when it's ready for everyone
  (`TopNav.tsx`, both desktop and mobile links).
- Migrate hardcoded `green-600` buttons to the `--primary` theme token.
- Gate hover states behind `@media (hover: hover)` app-wide.
- PostHog events for the Songs feature.
