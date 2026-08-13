# Launching this — what you actually need to do

You have the OMDb key. Here is everything from here to Papa opening it on his
phone. Total time: about 25 minutes, most of it waiting for signups.

---

## What each thing gets you

| | Have it? | What it unlocks |
|---|---|---|
| **OMDb key** | ✅ Yes | IMDb ratings + vote counts, RT critics scores, **real posters**, runtimes, cast, plot |
| **TMDB key** | ✅ Yes | **Which platform a title is on in India** — plus its own posters, genres, dub detection |
| **GitHub account** | ⬜ | Somewhere to put the code |
| **Vercel account** | ⬜ | The URL Papa opens. Free. |

Worth being clear about the split: **OMDb alone already gets you real posters.**
The `Poster` field it returns is IMDb's own artwork from Amazon's CDN, handed
over legitimately through their API. TMDB is not needed for pictures — it is
needed for *availability*, which is the one thing nothing else can tell you.

---

## Step 1 — Your keys go in one file

In the project folder, create a file called **`.env.local`**:

```
OMDB_API_KEY=a8fded46
TMDB_API_KEY=2adb3319166ac0cedb57615f4f6fbf79
DATA_MODE=auto
REGION=IN
LOCALE=en-IN
```

Use the **API Key (v3 auth)** — the short 32-character one. The long "API Read
Access Token" is for v4 bearer auth, which this app doesn't use.

That file is already in `.gitignore`, so it never gets committed or pushed.

> **One security note.** Your OMDb key was shared in a chat window. It's a free
> key with a 1,000/day cap so the exposure is minor, but if you'd rather be
> tidy, request a fresh one at omdbapi.com and swap it in here. Nothing else
> changes.

---

## Step 2 — Attribution (already done, but know why it's there)

TMDB's terms say: *"Please ensure you attribute TMDB for any images or data you
use."* Since posters, availability, genres and runtimes all come from them,
that is a condition of keeping your key.

There is now a small footer on the Tonight screen crediting TMDB and OMDb, plus
the required "not endorsed or certified by TMDB" line. Don't remove it — it is
the difference between a compliant personal project and one that can have its
key pulled.

**Check the keys work:** run the site, open **/admin**, look at *Provider
health*. Green dots next to TMDB and OMDb mean live. The "Starter catalogue"
note on the picks screen disappears at the same moment.

---

## Step 3 — Run it locally first

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. Click through it yourself once before showing
Papa — mark a few things as seen, take all four actions, make sure it feels
right.

---

## Step 4 — Put it online

### 4a. Push to GitHub

```bash
git init
git add .
git commit -m "What's Tonight"
```

Create an empty **private** repo at github.com/new, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/whats-tonight.git
git branch -M main
git push -u origin main
```

### 4b. Deploy on Vercel

1. **vercel.com** → sign in with GitHub
2. **Add New → Project** → import `whats-tonight` → **Import**
3. Leave every build setting alone (Vercel detects Next.js)
4. Expand **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `OMDB_API_KEY` | your OMDb key |
   | `TMDB_API_KEY` | your TMDB key |
   | `DATA_MODE` | `auto` |
   | `REGION` | `IN` |
   | `ADMIN_TOKEN` | any long random string |

5. **Deploy** — about a minute

You get a URL. Rename it under **Settings → Domains** to something Papa can
remember, like `papa-tonight.vercel.app`.

---

## Step 5 — Onto his phone

Send him the link. On his phone:

- **iPhone (Safari):** Share button → *Add to Home Screen*
- **Android (Chrome):** ⋮ → *Add to Home screen*

It gets an icon and opens without browser chrome. The manifest and iOS meta
tags are already in place, so it behaves like an app without being one.

---

## Step 6 — The first evening with him

This part matters more than the deploy, because it's what makes the
recommendations good.

Sit with him for the first ten minutes and walk him through onboarding. Step 2
shows a grid of well-known titles — get him to tap **everything he's already
seen**. He's watched a huge amount, so this is the single highest-value thing
you can do: every title he marks is one the engine will never waste a slot on.

Then let him use it normally. Tell him the four buttons are the whole app:

- **Watch this tonight** — going to watch it now
- **Seen it** — already watched, never show again
- **Later** — interesting, not tonight
- **Not for me** — don't want this one

Worth telling him explicitly: *"Not for me" only rules out that one film, not
the genre.* People assume these apps overreact and start avoiding the buttons.
This one doesn't, and he should tap freely.

---

## What to expect in the first few weeks

The engine deliberately does **not** trust itself early. For roughly the first
12 opinionated taps it ignores the learned profile completely and ranks purely
on quality, reviews, language and what he asked for tonight. Confidence then
ramps in gradually and tops out at 78% — some exploration always survives.

You can watch this happening at **/admin** → *Behavioural profile*. It will
say `Stage: learning, Confidence: 0%` at first, then start reporting what it
has actually worked out about the kind of thing he picks.

This is on purpose. A recommender that gets confident after five clicks starts
narrowing what it shows, which stops it ever learning it was wrong.

---

## If something looks off

**Everything says "Starter catalogue"** — `DATA_MODE` isn't `auto`, or the TMDB
key is missing. Check /admin.

**Posters are still coloured tiles** — the OMDb key isn't reaching the server.
On Vercel, check the environment variable is set for *all* environments, then
redeploy.

**Availability looks wrong** — TMDB's watch-provider data comes from JustWatch
and can lag a licensing change by a few days. It's the best legitimate source
there is; it isn't infallible.

**A film he's seen keeps appearing** — it only gets excluded once he marks it.
Use the Search tab to bulk-mark; that's what it's for.

**Ratings missing on some titles** — OMDb matches on IMDb ID where possible and
title+year otherwise. Obscure or regional titles sometimes don't match. The
card says "not available" rather than guessing.

---

## Running the checks yourself

```bash
npm run build && npm start
node verify.mjs          # 65 assertions, exits non-zero on failure
node test/omdb-parse.mjs # 10 assertions on the OMDb response parsing
```

`verify.mjs` drives a real browser at iPhone (390px), Pixel (412px) and desktop
sizes through onboarding, mood selection, filters, all four card actions,
regeneration, discovery mode, natural-language search, the cold-start rules,
and the mobile-web requirements (16px inputs, 44px tap targets, safe areas,
no horizontal scroll at 360px).
