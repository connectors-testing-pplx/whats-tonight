# Deploying without touching a terminal

You do not need to build this app — it is already built and tested. What you
need is to put the finished folder on the internet.

This page does that **entirely in a web browser**. No commands, no terminal, no
Node, no npm. About 12 minutes.

If you're comfortable with a terminal, `GO-LIVE.md` is faster (4 commands).
This is the alternative, not the fallback — the result is identical.

---

## What you need

- A **GitHub** account (free — github.com/signup)
- A **Vercel** account (free — you can sign in with GitHub)
- The unzipped `whats-tonight` folder

---

## Step 1 — Put the code on GitHub (5 minutes)

1. Go to **github.com/new**
2. **Repository name:** `whats-tonight`
3. Select **Private**
4. Do **not** tick "Add a README" or any other box
5. Click **Create repository**

On the next page, find the small link that says:

> **uploading an existing file**

Click it. You'll get a drag-and-drop box.

6. Open your unzipped `whats-tonight` folder
7. Select **everything inside it** (Ctrl+A / Cmd+A) and drag it into the box

> **Important:** drag the *contents* of the folder, not the folder itself.
> GitHub should end up showing `package.json`, `src`, `docs` and so on at the
> top level — not a single `whats-tonight` folder.

8. Wait for the upload bar to finish (it's a few hundred files)
9. At the bottom, click **Commit changes**

Done. Your code is on GitHub.

---

## Step 2 — Deploy on Vercel (5 minutes)

1. Go to **vercel.com** → **Sign Up** → **Continue with GitHub** → authorise
2. On the dashboard, click **Add New…** → **Project**
3. Find `whats-tonight` in the list → click **Import**
   - If you can't see it, click **Adjust GitHub App Permissions** and grant
     access to the repo
4. **Do not change any build settings.** Vercel detects Next.js on its own.
5. Click to expand **Environment Variables**, and add these four — typing the
   name in the left box and the value in the right, clicking **Add** each time:

   | Name | Value |
   |---|---|
   | `OMDB_API_KEY` | `a8fded46` |
   | `TMDB_API_KEY` | `2adb3319166ac0cedb57615f4f6fbf79` |
   | `DATA_MODE` | `auto` |
   | `REGION` | `IN` |

6. Click **Deploy**

Wait about a minute. You'll get a **Congratulations** screen with a live URL.

---

## Step 3 — Check it worked (2 minutes)

Open your new URL, then add `/admin` to the end of it:

```
https://your-project.vercel.app/admin
```

Look at the **Provider health** panel. You want:

- 🟢 **TMDB** — green dot
- 🟢 **OMDb** — green dot
- **Live data: Yes**

Then go back to the main page. If you see **real film posters** instead of
coloured tiles, everything is working.

### If posters are still coloured tiles

The environment variables didn't take. In Vercel:

**Settings → Environment Variables** — check all four are there and set to
**All Environments**. Then **Deployments → ⋯ on the newest one → Redeploy**.

---

## Step 4 — Give it a proper name

Vercel → your project → **Settings** → **Domains**.

Change the address to something Papa can remember and type:
`papa-tonight.vercel.app`, or similar. Free, instant.

---

## Step 5 — Onto his phone

Send him the link by WhatsApp. On his phone:

- **iPhone (Safari):** tap Share (the box with an arrow) → **Add to Home Screen**
- **Android (Chrome):** tap ⋮ → **Add to Home screen**

He gets an icon on his home screen. Tapping it opens the app full-screen with
no browser bars — it behaves like an installed app.

---

## Changing things later, still without coding

Every future change goes through the same two places:

**To change text, colours or settings:** edit the file directly on GitHub —
click the file, click the pencil icon, edit, **Commit changes**. Vercel
redeploys automatically within a minute.

**To change anything real:** use an AI coding tool on the folder. Any of these
work, and all of them take plain-English instructions:

| Tool | What it is |
|---|---|
| **Google Antigravity** | Google's agentic IDE — you describe a change, agents plan and edit across files, and it shows you what it did before you accept |
| **Cursor** | An editor with a chat panel; describe the change, review the diff |
| **Claude Code** | Terminal-based, but you only ever type English |

For any of them, open the `whats-tonight` folder and say what you want in
ordinary words. Useful things to know when you do:

- `src/lib/data/seed-titles.ts` — the offline starter catalogue
- `src/components/MoodGrid.tsx` — the eight mood tiles on the homepage
- `src/lib/engine/` — all the recommendation logic
- `src/app/page.tsx` — the Tonight screen

And two guardrails worth repeating to whatever tool you use, because they are
the things most likely to get quietly broken:

> Never invent ratings, reviews or availability. If a value is unknown it must
> stay null and the UI shows "not available".

> Never let a single tap create a genre-level preference. Learning is
> title-level and content-level, never "he dislikes thrillers".

After any change, run the two checks — or ask the tool to run them:

```
npm run preflight   # are the API keys live?
npm run verify      # 72 browser assertions
```
