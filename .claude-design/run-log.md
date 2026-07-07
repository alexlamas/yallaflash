# Design lab run log — ProgressPanel redesign

- Date: 2026-07-07
- Interview: skipped — brief derived from prior conversation (user asked for max breadth: actionable panel, backlog recovery, forest-as-telemetry, human stats).
- Route: `app/design-lab/` (App Router treats `_`-prefixed folders as private, so `__design_lab` is not routable).
- Variants:
  - A — Mission control (hierarchy + actionability, keeps mono aesthetic)
  - B — Living forest (forest IS the telemetry, tappable wilting trees)
  - C — Coach card (tutor voice, one primary door, spacious)
  - D — Progress HQ (game layer: goal ring, streak, week chart, milestones)
  - E — Teta's balcony (expressive Lebanese direction, PP Hatton, orchard)
- Shared fixtures: two scenarios (backlog = the screenshot state with 126 due; healthy). All actions simulate prompts to the chat tutor via an on-page console.

## Round 2 (after user rejected round 1)
- Feedback: "mix of mission control with something more visual; literal forest is bad UX; all of these look kinda shit". Round 1 also rendered broken in the user's browser (stale dev CSS — invisible green CTAs, no phone frames).
- Rebuilt: one shared chassis (chassis.tsx: next action → human stats → weakest 5) + three hero visuals:
  - F Memory field (vocabulary as tappable dot-matrix; overdue = hollow "asleep" rings)
  - G Orbit (time rings; words fall toward center review zone; count haloed in the zone)
  - H Forecast (7-day review load chart with the recovery plan drawn in)
- Deleted round-1 variants A–E. Cleared .next cache + restarted dev server for fresh CSS.
- Bugs fixed during verify: signed-shift hash gave negative band → NaN satellite coords (use >>>); SSR/client float drift in sin/cos → hydration mismatch (round to 2 decimals); banded dot scatter (coprime-stride permutation).

## Round 3 (user liked F + G, wants prize-worthy; spacing broken again on their side)
- Root cause of the user's broken spacing (both times): public/sw.js caches /_next static assets on localhost; their browser held stale CSS/JS. Lab page now unregisters the SW + clears arabic-flashcards-* caches on load. Spawned a background task chip to fix SW-in-dev properly.
- Dropped Forecast (H). Polished the two finalists:
  - F Memory field: staggered dot entrance, tap-to-spotlight (field dims to 0.22), tap empty space to release, refined palette (fading = amber-500), 52px-fixed legend/detail row so selection doesn't reflow.
  - G Orbit: true elliptical orbital drift (rotation inside a scale(1,0.8) plane, 160s/rev, pauses while inspecting + reduced-motion), pulsing due zone, haloed labels up the top axis, size-by-strength satellites.
- Bug found via screenshot: plain string hash gives consecutive values for consecutive suffixes → satellites chained into capsule-looking clumps. Fixed with an imul avalanche mix.

## Rounds 5–8 (condensed)
- R5: "see brain/memory fading" → K Synapses (neuron net going dark) + L Fading page (words blur per e^(-t/S)); hover-preview added, then fixed to clear on card mouseleave.
- R6: user picked the words road → M Ledger, N Word drift, O Notebook. Notebook rejected (baseline alignment); vocab pool expanded to 62 entries + distinct sampling (dupes looked like bugs).
- R7: P "The fold" = L + N synthesis; research grounding: Brath "Visualizing with Text" (weight > blur as data channel), Nicky Case ncase.me/remember (sweet-spot framing).
- R8 (current): Pudding alts on the fold benchmark — Q Essay (data-in-prose, PP Hatton lede), R Annotated fold (editorial callouts), S Pop quiz ("can you still read these?" blur = real recall), T Three beats (stepper scrollytelling). All verified in preview.

## Cleanup checklist (on finalize or abort)
- [ ] delete `app/design-lab/`
- [ ] delete `.claude-design/`
