# Getting the API keys

You do not need any of this to run the site. It works out of the box on a
packaged catalogue of ~45 titles. This guide is for when you want live data —
real posters, current availability, and current ratings.

Both keys below are free. Together they take about ten minutes.

---

## What an API key actually is

It's a long string of letters and numbers that works like a password. When this
site wants to know "what's the IMDb rating for Andhadhun?", it can't just look
it up — it has to ask another company's server. The key is how that server
knows the request is coming from you and not from a bot hammering it a thousand
times a second.

Keys go in a file called `.env.local`, which never leaves your machine and is
never committed to git. The site reads them on the server side only, so they
are never sent to your dad's phone.

---

## Key 1 — TMDB (the important one)

**What it gives you:** posters, genres, runtimes, languages, release dates,
cast — and, critically, **which platform a title is on in India**. This is the
one that makes "Available on Netflix" a real statement rather than a guess.

**Cost:** free. There is no paid tier for this use.

### Steps

1. Go to **https://www.themoviedb.org** and click *Join TMDB*. Sign up with an
   email address and verify it.
2. Log in, click your avatar (top right) → **Settings**.
3. In the left sidebar, click **API**.
4. Click **Request an API Key** → choose **Developer**.
5. Accept the terms. You'll get a short form:
   - *Type of use:* Personal
   - *Application name:* What's Tonight
   - *Application URL:* your Vercel URL, or `http://localhost:3000` for now
   - *Application summary:* "A personal recommendation site for my father,
     showing what's worth watching on his streaming subscriptions."
6. Submit. Approval is usually instant.
7. You'll land on a page showing **API Key (v3 auth)** — a 32-character string.
   Copy it.

Paste it into `.env.local`:

```
TMDB_API_KEY=paste_the_32_character_key_here
```

---

## Key 2 — OMDb (ratings)

**What it gives you:** the IMDb rating and vote count, and for many titles a
Rotten Tomatoes critics percentage.

**Cost:** free tier is 1,000 requests per day, which is far more than one
household will use.

### Steps

1. Go to **https://www.omdbapi.com/apikey.aspx**
2. Select the **FREE (1,000 daily limit)** radio button.
3. Enter your email, and put "Personal movie recommendation site" as the use
   case.
4. Submit. You'll get an email within a minute containing your key and an
   activation link — **click the activation link**, or the key won't work.

Paste it into `.env.local`:

```
OMDB_API_KEY=paste_your_key_here
```

---

## About Rotten Tomatoes

Worth being straight about this, because the brief asked for RT scores and you
will only get some of them.

Rotten Tomatoes has an official API, but it is only available to licensed
partners — studios, distributors, large platforms. There is no personal or
hobbyist tier, and no way to apply for one. Scraping their website is against
their terms of service and would break the first time they changed their HTML,
so this app doesn't do it.

What you get instead:

| Metric | Available? | How |
|---|---|---|
| RT **critics** score | Often | OMDb passes it through legitimately |
| RT critics review count | Rarely | Not carried by OMDb |
| RT **audience** score | **No** | No free legitimate source exists |

The audience row will say **"Not available"** on every card. That is deliberate
and it is the honest answer — the alternative would be showing your dad a number
that nobody actually computed.

If you ever do get licensed RT access, the fix is one file:
`src/lib/providers/` — implement the `RatingProvider` interface against it and
register it ahead of OMDb in `src/lib/providers/registry.ts`. Nothing else in the codebase needs
to change.

---

## Optional — better review summaries

The "What people are saying" paragraph is built in two stages: real review text
is retrieved from TMDB, a deterministic pass extracts recurring themes and their
sentiment, and then those themes get turned into readable prose.

Without an LLM key, that last step uses a built-in template writer. It's clear
but a little stiff. With a key it reads more naturally. Either way the *claims*
are identical — the model is never asked what people think, only to phrase what
the extracted evidence already says.

```
ANTHROPIC_API_KEY=sk-ant-...
```

Get one at **https://console.anthropic.com** → API Keys. It's pay-as-you-go and
this use would cost a few cents a month at one household's volume.

---

## Putting it together

Create the file:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in what you have. Minimum useful setup:

```
TMDB_API_KEY=your_tmdb_key
OMDB_API_KEY=your_omdb_key
DATA_MODE=auto
REGION=IN
```

Restart the dev server. Open **/admin** in a browser — the *Provider health*
panel will tell you, per source, whether the key is configured and whether the
service actually answered. Green dot means it's live.

The "Starter catalogue" note on the Tonight screen disappears once TMDB is
answering.

---

## If something isn't working

**Everything still says "starter catalogue"** — `DATA_MODE` might be set to
`seed`. Set it to `auto` and restart.

**OMDb returns nothing** — you probably didn't click the activation link in the
email. Check your spam folder.

**Availability looks wrong** — TMDB's watch-provider data comes from JustWatch
and can lag a licensing change by a few days. It's the best legitimate source
available; it isn't infallible.

**Ratings are missing on some titles** — OMDb matches on IMDb ID where possible
and title+year otherwise. Obscure or non-English titles sometimes don't match.
The card will say "Not available" rather than guess.
