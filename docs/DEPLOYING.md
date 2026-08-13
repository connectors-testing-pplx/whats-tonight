# Getting it onto your dad's phone

The goal is a URL he can bookmark. Both routes below give you one. Neither
requires a credit card for this scale of use.

Vercel is the shorter path. Firebase Hosting is the one to pick if you're
planning to do Phase 2 (Firestore) anyway, since it puts hosting, database and
auth in one console.

---

## Option A — Vercel (recommended, ~10 minutes)

Vercel is built by the people who make Next.js, so there's no configuration to
write.

### 1. Put the code on GitHub

```bash
cd whats-tonight
git init
git add .
git commit -m "What's Tonight — initial build"
```

Create an empty repository at https://github.com/new (make it **private** —
there's no secret in the code, but no reason to publish it either), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/whats-tonight.git
git branch -M main
git push -u origin main
```

### 2. Import it

1. Go to **https://vercel.com** and sign in with GitHub.
2. **Add New → Project**, pick the `whats-tonight` repo, click **Import**.
3. Leave every build setting alone — Vercel detects Next.js correctly.
4. Expand **Environment Variables** and add whichever keys you have:

   | Name | Value |
   |---|---|
   | `TMDB_API_KEY` | your TMDB key |
   | `OMDB_API_KEY` | your OMDb key |
   | `DATA_MODE` | `auto` |
   | `REGION` | `IN` |
   | `ADMIN_TOKEN` | any long random string |

   Leave them all set to "All Environments".
5. **Deploy.** It takes about a minute.

You get a URL like `whats-tonight-abc123.vercel.app`.

### 3. Give it a nicer name

In the project → **Settings → Domains**, you can change the subdomain to
something memorable, e.g. `dads-picks.vercel.app`. Free.

### 4. Add it to his home screen

On his phone, open the URL in Safari or Chrome, then:

- **iPhone (Safari):** Share button → *Add to Home Screen*
- **Android (Chrome):** ⋮ menu → *Add to Home screen*

It gets an icon and opens without browser chrome, which makes it feel like an
app without being one.

### Updating later

Push to `main`. Vercel rebuilds and redeploys automatically.

---

## Option B — Firebase Hosting

Choose this if you want Firestore in the same place. Note that Next.js server
routes need Firebase's web frameworks support, which uses Cloud Functions
underneath — you'll need the **Blaze** (pay-as-you-go) plan. For one household
the monthly cost is effectively zero, but a card has to be on file.

### 1. Set up the project

```bash
npm install -g firebase-tools
firebase login
```

Create a project at **https://console.firebase.google.com** (call it whatever
you like), then upgrade it to Blaze in the console — *Settings → Usage and
billing*.

### 2. Initialise hosting

```bash
cd whats-tonight
firebase experiments:enable webframeworks
firebase init hosting
```

Answer:

- *Use an existing project* → pick the one you just made
- *What do you want to use as your public directory?* → it detects Next.js and
  skips this
- *Set up automatic builds with GitHub?* → your call

### 3. Set the keys

Environment variables for the underlying function:

```bash
firebase functions:secrets:set TMDB_API_KEY
firebase functions:secrets:set OMDB_API_KEY
```

Or, simpler for a personal project, put them in `.env.local` and let the build
inline them server-side. Do **not** rename them with a `NEXT_PUBLIC_` prefix —
that would ship them to the browser.

### 4. Deploy

```bash
firebase deploy --only hosting
```

You get `your-project.web.app`. Same home-screen instructions as above.

---

## Option C — anywhere else

It's a standard Next.js 15 app with no platform-specific code. `npm run build`
then `npm start` behind any reverse proxy works fine — a small VPS, Railway,
Render, Fly, Netlify, a Raspberry Pi on your home network. The only requirement
is a Node runtime, because the API routes need to run server-side to keep the
keys off the client.

---

## Phase 2 — moving storage to Firestore

Right now everything (watched list, ruled-out titles, history) lives in the
browser's local storage on whichever device he uses. That's genuinely fine for
one person on one phone, and it means no login screen.

Move to Firestore when you want:

- the same watched list on his phone *and* his tablet
- the data to survive him clearing his browser
- to see what he's actually been picking

The work is contained. `src/lib/store/adapter.ts` defines a `PersistenceAdapter`
interface with four methods, and a `FirestoreAdapter` stub with the collection
layout already mapped out in comments. Implement those four methods, change the
`activeAdapter` export at the bottom of that file, and add Firebase Auth
(anonymous auth is enough — no password for him to remember). Nothing in the UI
or the recommendation engine touches storage directly, so nothing else changes.
