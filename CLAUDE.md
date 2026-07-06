# Yalla Flash - Project Documentation

## Overview

A Next.js web application for learning Lebanese Arabic using spaced repetition. Users can learn vocabulary words and phrases through flashcard-style review sessions. Live at https://yallaflash.com

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database & Auth**: Supabase (PostgreSQL + Auth)
- **Styling**: Tailwind CSS + Radix UI components
- **AI**: Anthropic Claude API (for sentence generation)
- **Deployment**: Vercel
- **Animations**: Framer Motion
- **Analytics**: PostHog (via MCP)

## PostHog Analytics

Project ID: 289335

### Tracked Events

| Event | Location | Description |
|-------|----------|-------------|
| `signup_cta_clicked` | LandingPage.tsx | User clicks any signup CTA (includes `location` property) |
| `signup_completed` | AuthProvider.tsx | User completes signup (also calls `posthog.identify`) |
| `onboarding_completed` | onboarding/page.tsx | User finishes onboarding (includes `fluency_level`, `packs_selected`) |
| `word_reviewed` | Review.tsx | User reviews a word (includes `rating`) |

### Active Experiments

| Experiment | Flag Key | Description |
|------------|----------|-------------|
| Hero Copy A/B Test | `hero-copy-test-exp` | Testing landing page hero copy. Control: "Learn Lebanese Arabic" / Teta copy. Variant: "Lebanese Arabic flashcards" / memory app positioning. |

### Using PostHog MCP

The PostHog MCP is configured for this project. Use it to:
- Query analytics data: `mcp__posthog__query-run`
- Check experiment results: `mcp__posthog__experiment-results-get`
- Create/update experiments: `mcp__posthog__experiment-create`, `mcp__posthog__experiment-update`
- Manage feature flags: `mcp__posthog__feature-flag-get-all`, `mcp__posthog__update-feature-flag`

## Project Structure

```
app/
├── (main)/              # Main authenticated routes
│   ├── page.tsx         # Home/dashboard
│   ├── review/          # Flashcard review session
│   ├── my-words/        # User's vocabulary (all/learning/learned tabs)
│   ├── this-week/       # Weekly progress
│   ├── this-month/      # Monthly progress
│   ├── onboarding/      # New user onboarding flow
│   ├── play/            # Games (memory/, speed-match/)
│   └── admin/           # Admin panel (packs, users, songs, review, design-system)
├── packs/               # Public pack browsing (SEO pages)
├── api/                 # API routes
│   ├── admin/              # Admin endpoints (roles, stats, users)
│   ├── ai-usage/           # AI credit usage tracking
│   ├── feedback/           # User feedback submission
│   ├── generate-sentence/  # AI sentence generation
│   ├── generate-hint/      # AI hints for words
│   ├── generate-caption/   # AI captions for Instagram
│   ├── generate-image/     # AI image generation
│   ├── stylize-image/      # AI image stylization
│   └── words/              # Word operations (create, bulk-extract)
├── components/          # UI components
│   ├── review/          # Review-specific components
│   └── ...              # Shared components
├── contexts/            # React contexts
│   ├── AuthContext.tsx  # Authentication state
│   ├── WordsContext.tsx # Word data state
│   └── ProfileContext.tsx # User profile state
├── providers/           # Context providers
│   ├── AuthProvider.tsx    # Auth state + PostHog identify
│   ├── WordsProvider.tsx   # Words data fetching
│   └── PostHogProvider.tsx # Analytics initialization
├── hooks/               # Custom React hooks
│   ├── useAIUsage.ts       # AI credit tracking
│   ├── useFilteredWords.ts # Word filtering logic
│   ├── useOfflineSync.ts   # Offline sync status
│   ├── useOfflineNavigation.ts # Offline-aware navigation
│   └── useUserRoles.ts     # User role checking
├── services/            # Business logic
│   ├── wordService.ts         # Word CRUD operations
│   ├── sentenceService.ts     # Sentence CRUD operations
│   ├── packService.ts         # Vocabulary pack operations
│   ├── adminService.ts        # Admin operations
│   ├── spacedRepetitionService.ts  # SRS algorithm
│   ├── offlineStorage.ts      # localStorage caching
│   ├── offlineQueue.ts        # Offline action queue
│   ├── syncService.ts         # Offline sync
│   ├── claudeService.ts       # AI integration
│   ├── aiUsageService.ts      # Monthly AI credit limits
│   ├── profileService.ts      # User profiles & avatars
│   ├── songService.ts         # Songs feature
│   ├── contentReviewService.ts # Content review workflow
│   ├── transliterationService.ts # Arabic transliteration
│   └── userService.ts         # User role caching
├── types/               # TypeScript types
│   └── word.ts          # Word & progress types
└── utils/               # Utility functions

components/              # shadcn/ui components
lib/                     # Shared utilities
utils/supabase/          # Supabase client setup
```

## Key Concepts

### Data Model

**Word**
- `id`, `arabic`, `english`, `transliteration`
- `type`: noun | verb | adjective | adverb | pronoun | particle | phrase
- `pack_id`: Links to vocabulary pack (null for custom words)
- `user_id`: Owner for custom words (null for pack words)
- `notes`: User notes

**Sentence** (example sentences, linked to words via `word_sentences`)
- `id`, `arabic`, `transliteration`, `english`
- `user_id`: Owner
- `pack_id`: Links to vocabulary pack (for pack sentences)
- Sentences can link to multiple words, and words can have multiple sentences

**Word Progress** (in `word_progress` table)
- `word_id`: Links to word
- `user_id`: Owner
- `status`: new | learning | learned
- `next_review_date`: SRS scheduling
- `interval`, `ease_factor`, `review_count`: SRS state

**ProgressState**: `new` -> `learning` -> `learned`

Note: Phrases (short multi-word expressions) are stored as words with `type='phrase'`. Full example sentences are in the `sentences` table.

### Spaced Repetition

The app uses a spaced repetition system (see `spacedRepetitionService.ts`):
- Words are scheduled for review based on performance
- Intervals increase as the user demonstrates knowledge
- "Boost" feature temporarily prioritizes a word

### Authentication

- Supabase Auth with Row Level Security (RLS)
- Multi-user support with user isolation
- Role-based access (`user_roles` table) for admin features

### Vocabulary Packs

Pre-built vocabulary sets that users can learn:
- Pack metadata stored in `packs` table
- Pack words stored in `words` table with `pack_id` set (and `user_id` null)
- User progress tracked in `word_progress` table linking `user_id` to `word_id`
- See `packService.ts` for pack operations

### Songs Feature

Learn Arabic through song lyrics with synced YouTube videos:
- Public routes: `/songs`, `/songs/[slug]`
- Admin routes: `/admin/songs`, `/admin/songs/[id]`
- Database tables: `songs`, `song_lines`, `song_line_words`
- `songService.ts` handles song data with `SongLine` and `SongLineWord` types
- SongPlayer component syncs lyrics with YouTube playback

### AI Usage & Credits

Monthly AI credit system for sentence generation:
- 20 free requests/month for regular users
- Unlimited for admin/reviewer roles
- Tracked in `ai_usage` table
- `useAIUsage` hook for checking remaining credits
- `/api/ai-usage` endpoint for usage data

## Native App (Capacitor)

The iOS/Android app packages the V2 tutor experience as a static export in a
Capacitor shell; the API stays on Vercel and is called cross-origin with a
Supabase bearer token. See `docs/NATIVE_APP.md` for the full architecture and
build steps (`npm run cap:sync`, then Xcode/Android Studio).

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

### Important: Don't run builds during development
Avoid running `npm run build` while the dev server is running - it interferes with the `.next` folder and breaks hot reloading. Use `npm run lint` to check for errors instead.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
ANTHROPIC_API_KEY=your_anthropic_key (for AI features)
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## Database

See `supabase/MIGRATION_INSTRUCTIONS.md` for database setup and migrations.

Key tables:
- `words` - Vocabulary items (both custom and pack words, including phrases with type='phrase')
- `sentences` - Example sentences showing words in context
- `word_sentences` - Join table linking words to sentences (many-to-many)
- `word_progress` - User progress tracking (links user_id to word_id)
- `packs` - Vocabulary pack metadata
- `user_profiles` - User profile data (includes fluency level, avatar)
- `user_roles` - Admin/user role management
- `ai_usage` - Monthly AI credit tracking per user
- `songs` - Song metadata (title, artist, YouTube URL)
- `song_lines` - Individual lyric lines with timestamps
- `song_line_words` - Words within each song line
- `transliteration_rules` - Database-driven transliteration mappings

## Common Tasks

### Adding a new page
1. Create folder in `app/(main)/your-page/`
2. Add `page.tsx` with component
3. Update navigation in `TopNav.tsx`

### Adding a new word field
1. Update `app/types/word.ts`
2. Update `wordService.ts` queries
3. Update relevant components (WordDetailModal, EditWord, etc.)

### Modifying spaced repetition
- Edit `app/services/spacedRepetitionService.ts`

### Working with Supabase
- Client: `utils/supabase/client.ts` (browser)
- Server: `utils/supabase/server.ts` (server components)

## Branding

- **Logo**: The app logo is a red pomegranate (`/public/logo.svg`)
- **Brand font**: PP Hatton (`font-title` or `font-pphatton` in Tailwind)

## Style Guide

### Text formatting
- Always use **sentence case** for UI text (headings, buttons, labels, etc.)
  - Correct: "AI credits", "Add new word", "Monthly limit reached"
  - Incorrect: "AI Credits", "Add New Word", "Monthly Limit Reached"
