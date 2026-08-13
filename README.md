# What's Tonight?

A personal evening concierge for one person: Papa, on his sofa at 9pm, with an
hour and a half and no patience for scrolling.

It asks one question — *what are you in the mood for?* — and answers with four
to six things worth watching, each carrying the ratings, the reception, the
language he'd watch it in, and the reason it was picked. Then it stops. There
is no catalogue to browse, because browsing is the problem it exists to solve.

```
Hi Papa 👋
What are you in the mood for tonight?

[🔥 Action]      [🕵️ Mystery]
[❤️ Family]      [😂 Light & Fun]
[💕 Romance]     [🧠 Great Story]
[😱 Suspense]    [🎞 Bollywood]
[🎲 Mix everything — surprise me]

                    ↓

1  BEST MATCH        Andhadhun        ⭐ 8.2  🇮🇳 Hindi          Netflix
2  STRONG MATCH      Shutter Island   ⭐ 8.2  🇮🇳 Hindi Dubbed   Netflix
3  YOU MAY HAVE…     Johnny Gaddaar   ⭐ 8.0  🇮🇳 Hindi          Prime Video
4  STRONG MATCH      Prisoners        ⭐ 8.2  🇬🇧 English Only   Netflix
                                             ⭐ Worth the exception
```

**→ Start here: [docs/LAUNCH.md](docs/LAUNCH.md)** — keys, deploy, and the first
evening with him.

---

## Run it

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. Works immediately with no keys at all, on a
packaged catalogue of ~90 India-available titles spanning 1975 to 2024.

---

## The three ideas it's built on

### 1. Language is a strong preference, never a gate

Papa watches Hindi, and Hollywood in Hindi dub. That's a major signal and the
engine treats it as one — a solid scoring bonus for Hindi and Hindi-dubbed, a
penalty for English-only.

But the penalty is **earnable back**. An 8.2-with-750k-votes English thriller
comes through and gets flagged *⭐ Worth the exception*; a 7.0 English film
does not, and correctly loses to a 7.6 Hindi one. The rule that captures what
he actually wants:

> A mediocre Hindi film should not beat an outstanding English one.

Every card states the language in plain words — **Hindi**, **Hindi Dubbed**,
**English Only** — never a language code. And when a dub can't be confirmed, it
says so rather than claiming there isn't one.

### 2. It learns content, not genres

There is no `Thriller = 5` anywhere in this codebase and never will be.

Every title becomes a vector across thirteen readable axes — how heavy, how
fast, how twisty, how funny, how grounded, how character-driven — plus genre,
era, industry, language and format. Papa's profile is the weighted mean of what
he's engaged with. Scoring a candidate is cosine similarity against it.

That distinction matters because *Andhadhun* and *Prisoners* are both filed
under Thriller and are nothing alike: one is playful and intricate, the other
bleak and grinding. A genre-matcher treats them as interchangeable. This
doesn't.

Deliberately **not** a learned embedding — these axes are hand-readable, so you
can open `/admin` and tell whether what it learned is sensible. A 384-dimension
embedding would be more expressive and completely unauditable. Bad trade for a
system that has to earn one specific person's trust.

### 3. Cold start is taken seriously

Papa has watched an enormous amount already. Two consequences:

- His first fifty taps are mostly telling us what he's **already seen**, not
  what he likes. So `SEEN_IT` carries **zero** taste weight — it excludes, and
  says nothing about tonight.
- Any confident model built from five interactions is wrong, and being wrong
  early is expensive: it narrows what he's shown, so he stops seeing the things
  that would have corrected it.

So confidence is staged. Below **12** opinionated interactions the profile
contributes **exactly zero** — not a small number, zero. It then ramps in
gradually and caps at **78%**, so there is always room to show him something
the model wouldn't have predicted.

Watch it at `/admin` → *Behavioural profile*.

---

## What's on a card

Collapsed: poster, title, IMDb rating with vote count, language, platform. A
coloured spine down the left edge encodes language — green for Hindi available,
purple for English only — readable before a word is parsed.

Behind **Read more**: runtime, genre, era, industry, full ratings, plot, **cast**,
what people are saying, why we picked it, and *Find more like this*.

**Everything shown is either a fact or explicitly absent.** IMDb scores appear
with their vote count, because 8.1 from 350K and 8.1 from 900 are different
claims. Anything unknown says *not available* — including Rotten Tomatoes
audience scores, which have no free legitimate source and therefore say so on
every single card.

### Four actions, one tap each

| Action | Effect |
|---|---|
| ▶ **Watch this tonight** | Strong positive signal. Card stays, confirmed. |
| ✓ **Seen it** | Excluded permanently. Card clears instantly. |
| 🕐 **Later** | Rests 10 days, then mixes back in. Card clears. |
| ✕ **Not for me** | **That title excluded — not that genre.** Card clears. |

No confirmation screens.

---

## Beyond mood

**More filters** — genre, era (1970s → new releases), cinema (Bollywood /
Hollywood / South Indian / International), language, movie-or-series, runtime,
platform. All combinable: *Hollywood + 2000s + Action + Hindi dubbed*.

**Natural language** — type "a 2000s Bollywood comedy" or "something with a
shocking twist that I probably haven't seen". A deterministic parser handles
the common patterns for free and offline; an LLM handles the fuzzy ones. It
returns **criteria, never titles** — asking a model to name six films would
cheerfully hallucinate ratings, availability and sometimes the films.

**💎 Things you may have missed** — discovery mode, weighted hard toward
quality with low audience saturation.

**🎬 Find more like this** — similarity across story, tone, pace, cast,
director, era and language. Not "same genre".

**🔄 Give me different picks** — a genuinely new set, not a reshuffle.

---

## Data

Four swappable interfaces: `MetadataProvider`, `RatingProvider`,
`ReviewProvider`, `StreamingProvider`. Nothing above that layer knows which
service answered.

| Source | Provides |
|---|---|
| **TMDB** | Posters, genres, runtime, cast, dub detection, **India availability** |
| **OMDb** | IMDb rating + votes, RT critics score, **IMDb's own posters** |
| **TMDB reviews** | Review text → extracted themes → summary |
| **Packaged catalogue** | ~90 titles, works offline, always present |

**On posters:** OMDb's `Poster` field is IMDb's own artwork from Amazon's CDN,
handed over legitimately through their API. An OMDb key alone gets real
posters — TMDB is needed for *availability*, not pictures.

**On Rotten Tomatoes:** their API is licensed-partners-only with no personal
tier. This app does not scrape them. The critics percentage comes through OMDb;
the audience score is genuinely unobtainable and is reported as such.

**On the LLM:** two jobs only — interpreting a typed request into criteria, and
phrasing already-retrieved review evidence. It is never asked what a film is
rated, where it's streaming, or what people think. With no key configured, an
offline summariser makes identical claims in plainer prose.

**Attribution:** TMDB's terms require it. The footer credits TMDB and OMDb and
carries the required "not endorsed or certified" line. Don't remove it.

---

## Verified, not asserted

```bash
npm run build && npm start
node verify.mjs           # 72 assertions
node test/omdb-parse.mjs  # 10 assertions on OMDb response parsing
```

`verify.mjs` drives a real Chromium at **iPhone (390px)**, **Pixel (412px)** and
desktop through onboarding, mood selection, every filter group, all four card
actions, regeneration, discovery mode, natural-language search, the
English-only exception, the cold-start rules, and the mobile-web requirements.

**72 checks, all passing.** Exits non-zero on failure.

### Mobile web specifics it enforces

Every input ≥16px (below that iOS Safari force-zooms with no way back), every
standalone control ≥44px, `viewport-fit=cover` for the iPhone home indicator,
`overscroll-behavior-y: none` to stop Android's pull-to-refresh firing mid-list,
`100dvh` so the bottom bar doesn't hide under the URL bar, no horizontal scroll
at 360px, and a web manifest so Add to Home Screen opens without browser chrome.
Pinch zoom stays enabled — disabling it is an accessibility failure.

---

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind.
No database needed. Local storage behind a swappable `PersistenceAdapter`, with
a Firestore adapter stubbed and mapped for later.

API keys are server-side only — nothing is prefixed `NEXT_PUBLIC_`, so they are
never bundled into client JavaScript. Papa's data never leaves his device.

---

## Where things live

```
src/lib/engine/
  vector.ts     content vectors + similarity  ← the "not genres" bit
  profile.ts    behavioural profile + cold start
  language.ts   Hindi preference + English exception
  filter.ts     hard gates (never genre, never language)
  rank.ts       eleven scored components, all transparent
  slots.ts      how many picks, and which slot each fills
  nlq.ts        natural language → criteria
  explain.ts    why we picked this, in words
src/lib/providers/   the four interfaces + TMDB, OMDb, reviews, seed
src/app/             Tonight · Later · Watched · Search · onboarding · admin
docs/                LAUNCH · GETTING-API-KEYS · DEPLOYING · ARCHITECTURE
verify.mjs           the acceptance checklist, executable
```

---

## Honest status

**Working:** the whole thing — mood-first UI, the full pipeline, behavioural
learning with cold-start staging, language preference with the exception rule,
era and industry filters, natural-language and semantic search, find-similar,
discovery mode, trending, Later recycling, all four actions, onboarding, the
developer dashboard, and both provider adapters.

**Needs you:** a deploy. Keys are in hand.

**Not built:** Firestore persistence (stubbed and mapped — not needed for one
person on one phone) and Firebase Auth (there's no second user to distinguish).

**Not verified here:** the live TMDB and OMDb calls. The build sandbox has no
outbound internet, so the adapters were tested against a recorded response
rather than the network. First live request happens on your machine — check
`/admin` → *Provider health*.
