# Go live — 10 minutes

The repo is already initialised and committed. Both keys are ready. All that's
left is putting it on the internet.

There are two routes. **Route A is faster and needs no GitHub account.** Route B
takes five minutes longer but means future changes deploy automatically when you
push. Pick one.

---

# ROUTE A — Vercel CLI (fastest, ~5 minutes)

## 1. Unzip and install

```bash
cd whats-tonight
npm install
```

## 2. Create your keys file

Create a file called **`.env.local`** in the `whats-tonight` folder:

```
OMDB_API_KEY=a8fded46
TMDB_API_KEY=2adb3319166ac0cedb57615f4f6fbf79
DATA_MODE=auto
REGION=IN
LOCALE=en-IN
```

## 3. Check the keys actually work — do not skip this

```bash
npm run preflight
```

Ten seconds. It calls TMDB and OMDb for real and tells you, in plain English,
whether each one works — including whether TMDB can see India availability and
whether OMDb returns posters.

**This is the one thing that was never tested during the build.** The machine
this was built on had no outbound internet, so every live API call is unproven
until you run this. Everything else has been verified.

Expected output:

```
  ✓  TMDB key present and correctly shaped
  ✓  OMDb key present
  ✓  TMDB accepts the key
  ✓  TMDB returns titles streaming in IN
  ✓  TMDB returns per-title platform availability
  ✓  TMDB returns poster paths
  ✓  OMDb accepts the key
  ✓  OMDb returns IMDb ratings
  ✓  OMDb passes through RT critics scores
  ✓  OMDb returns IMDb poster images
  ✓  OMDb resolves Hindi titles

  All 11 checks passed. Both keys are live and working.
```

If anything fails it tells you exactly what to fix. Common ones:

| Message | Fix |
|---|---|
| "That is the long API Read Access Token" | Use the short 32-character key |
| HTTP 401 | Key rejected — regenerate on themoviedb.org |
| "click the activation link" | Check your OMDb email |
| HTTP 403 / no internet | VPN, firewall or corporate proxy in the way |

Then have a look at it yourself:

```bash
npm run dev
```

Open **http://localhost:3000**. Real posters mean it's all working.

## 4. Deploy

```bash
npx vercel
```

First run will:

- ask you to log in → a browser opens, sign in with email or GitHub
- **Set up and deploy?** → `y`
- **Which scope?** → your personal account
- **Link to existing project?** → `n`
- **Project name?** → press Enter (or type `papa-tonight`)
- **In which directory is your code?** → press Enter
- **Modify settings?** → `n`

It builds and gives you a preview URL.

## 5. Add the keys to Vercel

The keys in `.env.local` are on your machine only — the server needs its own
copy:

```bash
npx vercel env add OMDB_API_KEY production
npx vercel env add TMDB_API_KEY production
npx vercel env add DATA_MODE production
npx vercel env add REGION production
```

Each one prompts for the value. Paste, press Enter.
(`DATA_MODE` = `auto`, `REGION` = `IN`.)

## 6. Ship it

```bash
npx vercel --prod
```

**That's your live URL.** Open it on your phone to confirm.

> Shortcut for later: `npm run golive` runs preflight and then deploys to
> production in one go, so a broken key can never reach the live site.

---

# ROUTE B — GitHub + Vercel (auto-deploys on every change)

Do this instead if you plan to keep changing the site.

## 1. Push to GitHub

Create an empty **private** repo at **github.com/new** — name it
`whats-tonight`, don't add a README or .gitignore.

Then, in the `whats-tonight` folder:

```bash
git remote add origin https://github.com/YOUR_USERNAME/whats-tonight.git
git branch -M main
git push -u origin main
```

The commit is already made, so this just pushes it.

## 2. Import into Vercel

1. **vercel.com** → sign in with GitHub
2. **Add New → Project**
3. Find `whats-tonight` → **Import**
4. Leave every build setting alone — Vercel detects Next.js
5. Expand **Environment Variables** and add these four:

   | Name | Value |
   |---|---|
   | `OMDB_API_KEY` | `a8fded46` |
   | `TMDB_API_KEY` | `2adb3319166ac0cedb57615f4f6fbf79` |
   | `DATA_MODE` | `auto` |
   | `REGION` | `IN` |

   Leave each set to **All Environments**.

6. **Deploy**

From now on, `git push` redeploys automatically.

---

# After it's live (both routes)

## Give it a nicer name

Vercel → your project → **Settings → Domains**. Change the subdomain to
something memorable, like `papa-tonight.vercel.app`. Free.

## Confirm live data is on

Open **`your-url.vercel.app/admin`**. You want:

- **Live data: Yes**
- Green dots on TMDB and OMDb
- The "Starter catalogue" note **gone** from the picks screen
- Real posters instead of coloured tiles

If posters are still coloured tiles, the env vars didn't take — check they're
set for *all* environments in Vercel, then redeploy.

## Lock the developer view

`/admin` is currently open to anyone with the URL. Set a token:

```bash
npx vercel env add ADMIN_TOKEN production
```

Give it any long random string. After that, `/admin` needs
`?key=YOUR_TOKEN` on the end.

## Put it on Papa's phone

Send him the link. On his phone:

- **iPhone (Safari):** Share → *Add to Home Screen*
- **Android (Chrome):** ⋮ → *Add to Home screen*

It gets an icon and opens without browser chrome.

---

# The first evening with him

This matters more than the deploy, because it's what makes the recommendations
actually good.

**Sit with him through onboarding.** Step 2 shows a grid of well-known titles —
get him to tap **everything he's already seen**. He's watched a huge amount, so
this is the highest-value ten minutes available: every title he marks is a slot
the engine will never waste.

**Then tell him the four buttons are the whole app:**

- **▶ Watch this tonight** — going to watch it now
- **✓ Seen it** — already watched, never show again
- **🕐 Later** — interesting, not tonight
- **✕ Not for me** — don't want this one

**And say this explicitly:** *"Not for me" rules out that one film, not the
genre.* People assume these apps overreact and start avoiding the buttons,
which starves the thing of exactly the information it needs. This one doesn't
overreact, and he should tap freely.

---

# What to expect

**First two weeks:** it ranks on quality, reviews, language and what he asked
for. The learned profile contributes *exactly zero* until 12 opinionated taps —
not a small amount, zero. This is deliberate: a recommender that gets confident
after five clicks narrows what it shows and never learns it was wrong.

**After that:** confidence ramps in gradually, capping at 78%. Some exploration
always survives.

You can watch the whole thing at `/admin` → *Behavioural profile*. It reports
its stage, its confidence, and in plain English what it has actually worked out
about the kind of thing he picks.

---

# If something breaks

| Symptom | Cause |
|---|---|
| Build fails on Vercel | Almost always a missing env var. Check all four are set. |
| "Starter catalogue" still showing | `TMDB_API_KEY` not reaching the server. Redeploy after adding. |
| Posters are coloured tiles | `OMDB_API_KEY` not reaching the server, or not activated. |
| Availability looks wrong | TMDB's data comes from JustWatch and can lag a licensing change by days. Best legitimate source there is; not infallible. |
| A film he's seen keeps appearing | It's only excluded once marked. Use Search to bulk-mark. |
| Ratings missing on some titles | OMDb couldn't match it. The card says "not available" rather than guessing. |

## Re-run the checks any time

```bash
npm run build && npm start
node verify.mjs           # 72 browser assertions
node test/omdb-parse.mjs  # 10 parsing assertions
```
