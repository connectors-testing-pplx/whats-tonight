# Architecture

How the thing is put together, and why it's put together that way.

---

## The shape of it

```
Browser (his phone)
  │
  │  posts his own state — watched list, ruled-out titles, history
  ▼
/api/recommendations   ← server-side, holds the API keys
  │
  ├─ registry.ts  picks which providers are live
  │    ├─ TMDB      metadata, posters, India availability
  │    ├─ OMDb      IMDb rating + votes, RT critics
  │    ├─ Reviews   TMDB review text → themes → summary
  │    └─ Seed      packaged fallback, always present
  │
  ▼
engine/            discover → filter → rank → diversify → explain
  │
  ▼
four Recommendations, each with its reasoning attached
```

Two decisions are load-bearing:

**Keys never leave the server.** Every provider call happens inside an
`/api/*` route handler. Nothing is prefixed `NEXT_PUBLIC_`, so Next.js won't
bundle it into client JavaScript.

**His data never leaves his device** (in Phase 1). The client posts its state up
with each request, the server computes against it and returns picks, and nothing
is retained. There's no account and no database to breach.

---

## The provider layer

Four interfaces in `src/lib/providers/types.ts`:

| Interface | Answers | Reference implementation |
|---|---|---|
| `MetadataProvider` | What is this title? | TMDB |
| `RatingProvider` | What did people score it? | OMDb |
| `ReviewProvider` | What did people say about it? | TMDB reviews + summariser |
| `StreamingProvider` | Where can he watch it? | TMDB watch/providers |

`registry.ts` decides which adapters are live, merges their output, and falls
back to the seed catalogue when something is unconfigured or down.

The merge rule is one line and it matters: **a real value wins, and `null` never
overwrites a known value.** Nothing in this codebase invents a number to fill a
gap. A gap stays a gap and the card renders "Not available".

Adding a fifth source — a licensed RT feed, JustWatch, a regional catalogue —
means writing one adapter and adding one line to the registry. The engine and
the UI don't know or care where data came from.

---

## The recommendation engine

Six stages, in `src/lib/engine/`:

### 1. Discover (`registry.discoverTitles`)
Pull a broad pool of titles that are on his platforms, in India, above a floor
of quality. Around 80–120 candidates.

### 2. Enrich (`registry.enrichTitle`)
Only the top 24 get the expensive treatment — ratings lookups, review
retrieval, availability confirmation. Enriching all 120 to display 4 would burn
the OMDb daily quota in a handful of page loads.

### 3. Filter (`filter.ts`)
Hard yes/no gates. Removes anything marked seen, anything ruled out, anything
not on a subscribed platform, anything shown in the last 21 days, anything in
the Maybe Later cooldown, anything below the quality floor, anything that
doesn't fit the stated time budget.

**Note what is absent from this list: genre.** Genre never eliminates a
candidate, no matter what he's tapped.

If the filters leave fewer than four candidates, the *softest* constraint (how
recently something was shown) is relaxed first — never a hard rule.

### 4. Rank (`rank.ts`)
A weighted sum, every component stored in the breakdown so `/admin` and "Why
this?" can show their working:

| Component | Max | What it measures |
|---|---|---|
| Quality | 40 | IMDb + RT, **discounted by vote count** |
| Agreement | 14 | Do critics and audiences actually agree? |
| Reception | 12 | Sentiment across the extracted review themes |
| Runtime fit | 14 | Does it fit the evening he said he has? |
| Mood | 10 | Genre and theme match to tonight's mood |
| Discovery | 10 | How likely is it he *hasn't* already seen this? |
| Taste | ±10 | Learned preference, heavily capped — see below |

The vote-count discount is the interesting one. An 8.6 from 900 votes gets
pulled back towards the middle; an 8.2 from 400,000 does not. A rating without
a crowd behind it is a rumour.

### 5. Diversify (`diversify.ts`, `slots.ts`)
Maximal marginal relevance: each pick is scored on quality *minus* how much it
resembles what's already been chosen. Similarity is a weighted blend of genre
overlap, language, type, era and platform.

Then the four slots, which are four different questions rather than four draws
from one list:

- **Best Match** — top of the ranking, full stop.
- **Hidden Gem** — quality first, then heavily weighted towards low audience
  saturation. This is the slot that addresses "he's already seen everything
  popular."
- **Different Mood** — explicitly the *least similar* thing to the first two
  that's still good. The genre is not fixed; it falls out of the pool.
- **Wildcard** — the only slot with randomness, and even then the pool is
  pre-filtered on quality and dissimilarity. "Different" is never an excuse for
  "bad."

### 6. Explain (`explain.ts`)
Builds the one-line "Why we picked this" and the itemised "Why this?" list.
Every line corresponds to a fact already on the title object. If the fact is
missing, the line is absent. There is no template that says "critically
acclaimed" unless a critic score is sitting right there.

---

## Conservative learning

`src/lib/engine/taste.ts` exists to prevent one specific failure: concluding
"Dad dislikes thrillers" because he passed on a thriller.

The rules:

1. **Title-level is absolute.** Seen or ruled-out excludes that title
   permanently. No inference.
2. **Genre signals require ≥6 actions in that genre**, and a split more lopsided
   than 75/25. Below either threshold the signal is exactly zero.
3. **Even a fully earned signal is capped at ±6 points** on a 100-point score.
   It can break a near-tie. It can never eliminate anything.
4. **Negative signals are discounted 50%.** "I watched this" is unambiguous;
   "not interested" could mean a dozen things.
5. **Signals decay** over 180 days.
6. **`SEEN_IT` carries zero taste weight.** Onboarding bulk-marks watched
   titles, which would otherwise flood the signal with noise.

You can watch this working in `/admin` → *Learned preference signals*. It shows
what has and hasn't cleared the threshold, and why. For a new user it says, in
so many words, "not enough evidence, ranking on quality alone" — which is the
correct behaviour and the thing most recommenders get wrong.

---

## Stability and freshness

The four picks must be identical every time he opens the site during one
evening, and different tomorrow.

The mechanism is a seeded PRNG (`engine/random.ts`) keyed on
`date # revision # mood`. Same inputs, same stream, same wildcard. The copy
cached in local storage is an optimisation, not the source of truth — the same
four would regenerate from scratch.

"Give me different picks" bumps the revision and passes the current four as
exclusions. It's a different draw, not an infinite scroll: the same filters,
quality bar and diversity constraints all still apply.

The daily rollover clears the mood and time budget too. What he was in the mood
for last night shouldn't steer tonight.

---

## Persistence

`src/lib/store/adapter.ts` defines `PersistenceAdapter` with four methods:
`load`, `save`, `clear`, `isAvailable`. The local-storage implementation writes
the whole state as one JSON document under one key, which keeps writes atomic
and makes export/import trivial (both are in `/admin`).

`FirestoreAdapter` is a stub with the collection layout mapped out in comments.
Swapping is: implement the four methods, change the `activeAdapter` export.

---

## File map

```
src/
  app/
    page.tsx                  Tonight — the whole product
    onboarding/page.tsx       Two steps: platforms, then seed the watched list
    maybe-later/page.tsx      The cooldown queue, with days remaining shown
    watched/page.tsx          The exclusion list, searchable and sortable
    search/page.tsx           Find and bulk-mark titles
    admin/page.tsx            Developer dashboard, not linked from the UI
    api/
      recommendations/        The engine endpoint
      search/                 Title/cast/genre search
      popular/                Onboarding's "seen it?" grid
      status/                 Provider health, feeds /admin
  components/                 Card, poster, ratings, sheet, nav, pickers
  lib/
    types.ts                  Domain model. Every uncertain field is nullable.
    providers/                The four interfaces + TMDB, OMDb, reviews, seed
    engine/                   filter, rank, diversify, slots, explain, taste
    store/                    Persistence adapter + React store
    data/seed-titles.ts       The packaged catalogue
    utils/                    Formatting and the consensus-badge calculation
verify.mjs                    The Phase 8 checklist, as an executable script
```

---

## Running the checks

```bash
npm run build          # must pass clean
npm run typecheck      # strict TypeScript, no errors
npm start              # serve on :3000

# in another terminal
BASE=http://localhost:3000 node verify.mjs
```

`verify.mjs` drives a real browser at 390px through the whole flow: onboarding,
four picks, all four actions, same-day stability, the next-day rollover, seen
and rejected exclusion, Maybe Later recycling, search, and the admin view. 38
assertions. It exits non-zero on any failure, so it's CI-ready as-is.
