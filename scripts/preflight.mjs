#!/usr/bin/env node
/**
 * Preflight — checks both API keys actually work, before you deploy.
 *
 * This exists because the machine that built this app had no outbound
 * internet, so the live TMDB and OMDb calls were never executed against the
 * real services. Everything else is verified; this is the one gap, and this
 * script closes it in about ten seconds on your machine.
 *
 *   node scripts/preflight.mjs
 *
 * Exits non-zero if anything is wrong, so you find out here rather than after
 * a deploy.
 */

import { readFileSync, existsSync } from 'node:fs';

// --- Load .env.local without a dependency ---------------------------------
function loadEnv() {
  const path = '.env.local';
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const TMDB = env.TMDB_API_KEY;
const OMDB = env.OMDB_API_KEY;
const REGION = env.REGION || 'IN';

const results = [];
const ok = (name, detail = '') => results.push({ name, pass: true, detail });
const bad = (name, detail = '') => results.push({ name, pass: false, detail });

const line = (s = '') => console.log(s);

/**
 * Parse JSON, but turn "the proxy returned an HTML error page" into something
 * a human can act on rather than a SyntaxError about an unexpected token.
 */
async function readJson(res, service) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `${service} did not return JSON (HTTP ${res.status}). ` +
        `This usually means no internet access, or a proxy/firewall is blocking it. ` +
        `Got: ${text.slice(0, 60).replace(/\s+/g, ' ')}…`
    );
  }
}

line();
line('  Preflight — checking your keys against the real services');
line('  ' + '─'.repeat(56));
line();

// --- 1. Keys present and shaped right -------------------------------------
if (!TMDB) {
  bad('TMDB key present', 'TMDB_API_KEY missing from .env.local');
} else if (TMDB.startsWith('eyJ')) {
  bad(
    'TMDB key is the right one',
    'That is the long "API Read Access Token" (v4). Use the short 32-character "API Key (v3 auth)" instead.'
  );
} else if (!/^[a-f0-9]{32}$/i.test(TMDB)) {
  bad('TMDB key looks valid', `Expected 32 hex characters, got ${TMDB.length}. Check for stray spaces or quotes.`);
} else {
  ok('TMDB key present and correctly shaped');
}

if (!OMDB) {
  bad('OMDb key present', 'OMDB_API_KEY missing from .env.local');
} else {
  ok('OMDb key present');
}

// --- 2. TMDB actually answers ---------------------------------------------
if (TMDB && !TMDB.startsWith('eyJ')) {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${TMDB}`);
    if (res.status === 401) {
      bad('TMDB accepts the key', 'HTTP 401 — the key was rejected. Regenerate it on themoviedb.org.');
    } else if (res.status === 403) {
      bad(
        'TMDB reachable',
        'HTTP 403 — the request never reached TMDB. Almost always a firewall, VPN or corporate proxy. Try from a normal home connection.'
      );
    } else if (!res.ok) {
      bad('TMDB accepts the key', `HTTP ${res.status}`);
    } else {
      ok('TMDB accepts the key');

      // The whole point of TMDB for this app: India availability.
      const disc = await fetch(
        `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB}` +
          `&watch_region=${REGION}&with_watch_providers=8|119|122` +
          `&with_watch_monetization_types=flatrate&sort_by=vote_average.desc` +
          `&vote_count.gte=300&vote_average.gte=7`
      );
      const discJson = await readJson(disc, 'TMDB');
      const count = discJson.results?.length ?? 0;
      if (count > 0) {
        ok(
          `TMDB returns titles streaming in ${REGION}`,
          `${count} on the first page, e.g. "${discJson.results[0].title}"`
        );

        // Availability for one real title, end to end.
        const id = discJson.results[0].id;
        const prov = await fetch(
          `https://api.themoviedb.org/3/movie/${id}/watch/providers?api_key=${TMDB}`
        );
        const provJson = await readJson(prov, 'TMDB');
        const flat = provJson.results?.[REGION]?.flatrate ?? [];
        if (flat.length) {
          ok(
            'TMDB returns per-title platform availability',
            `"${discJson.results[0].title}" → ${flat.map((f) => f.provider_name).join(', ')}`
          );
        } else {
          bad('TMDB returns per-title platform availability', `No flatrate providers listed for ${REGION}`);
        }

        // Poster path — the visual half of the product.
        if (discJson.results[0].poster_path) {
          ok('TMDB returns poster paths', `https://image.tmdb.org/t/p/w500${discJson.results[0].poster_path}`);
        } else {
          bad('TMDB returns poster paths', 'No poster_path on the first result');
        }
      } else {
        bad(`TMDB returns titles streaming in ${REGION}`, 'Empty result set — check REGION is a valid ISO country code');
      }
    }
  } catch (err) {
    bad('TMDB reachable', err.message);
  }
}

// --- 3. OMDb actually answers ---------------------------------------------
if (OMDB) {
  try {
    const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB}&i=tt0903747`);
    const json = await readJson(res, 'OMDb');
    if (json.Response === 'False') {
      const activation = /activat/i.test(json.Error ?? '')
        ? ' — click the activation link in the email OMDb sent you.'
        : '';
      bad('OMDb accepts the key', `${json.Error}${activation}`);
    } else {
      ok('OMDb accepts the key', `Test lookup returned "${json.Title}"`);

      if (json.imdbRating && json.imdbRating !== 'N/A') {
        ok('OMDb returns IMDb ratings', `${json.imdbRating} from ${json.imdbVotes} votes`);
      } else {
        bad('OMDb returns IMDb ratings', 'imdbRating was N/A');
      }

      const rt = json.Ratings?.find((r) => r.Source === 'Rotten Tomatoes');
      if (rt) ok('OMDb passes through RT critics scores', rt.Value);
      else ok('OMDb RT critics score', 'absent for this title — normal, varies by title');

      if (json.Poster && json.Poster !== 'N/A') {
        ok('OMDb returns IMDb poster images', json.Poster.slice(0, 60) + '…');
      } else {
        bad('OMDb returns IMDb poster images', 'Poster was N/A');
      }
    }
  } catch (err) {
    bad('OMDb reachable', err.message);
  }

  // A Hindi title, since that is what most of the catalogue is.
  try {
    const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB}&t=Andhadhun&y=2018`);
    const json = await readJson(res, 'OMDb');
    if (json.Response === 'True') {
      ok('OMDb resolves Hindi titles', `"${json.Title}" → ⭐ ${json.imdbRating}`);
    } else {
      bad('OMDb resolves Hindi titles', json.Error ?? 'not found');
    }
  } catch (err) {
    bad('OMDb Hindi lookup', err.message);
  }
}

// --- Report ----------------------------------------------------------------
for (const r of results) {
  const mark = r.pass ? '  ✓' : '  ✗';
  line(`${mark}  ${r.name}`);
  if (r.detail) line(`     ${r.detail}`);
}

const failed = results.filter((r) => !r.pass);
line();
line('  ' + '─'.repeat(56));
if (failed.length === 0) {
  line(`  All ${results.length} checks passed. Both keys are live and working.`);
  line();
  line('  Next:  npx vercel  →  add the env vars  →  npx vercel --prod');
  line('         Full steps in GO-LIVE.md');
  line();
  process.exit(0);
} else {
  line(`  ${results.length - failed.length}/${results.length} passed — ${failed.length} problem${failed.length === 1 ? '' : 's'} to fix first:`);
  line();
  for (const f of failed) line(`  ✗  ${f.name}\n     ${f.detail}`);
  line();
  process.exit(1);
}
