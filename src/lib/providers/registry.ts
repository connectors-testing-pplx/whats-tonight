import type { Ratings, Title } from '@/lib/types';
import { omdbProvider } from './omdb';
import { reviewProvider } from './review';
import { seedProvider } from './seed';
import { tmdbProvider } from './tmdb';
import type {
  DiscoverQuery,
  MetadataProvider,
  ProviderHealth,
  RatingProvider,
  ReviewProvider,
  SearchQuery,
  StreamingProvider,
} from './types';

/**
 * The registry decides which adapters are live and merges their output.
 *
 * Merge rule, applied everywhere: a real value from a real source always wins,
 * and `null` never overwrites a known value. Nothing here ever manufactures a
 * number to fill a hole — holes stay holes and the UI renders them honestly.
 */

export type DataMode = 'seed' | 'live' | 'auto';

export function dataMode(): DataMode {
  const raw = (process.env.DATA_MODE ?? 'auto').toLowerCase();
  if (raw === 'seed' || raw === 'live') return raw;
  return 'auto';
}

export function isLive(): boolean {
  const mode = dataMode();
  if (mode === 'seed') return false;
  if (mode === 'live') return true;
  return tmdbProvider.isConfigured();
}

/**
 * Whether per-title enrichment is worth doing.
 *
 * Deliberately broader than isLive(): with only an OMDb key, TMDB availability
 * stays seeded but OMDb still supplies real posters, ratings, runtimes and
 * cast. That is a large upgrade on its own, so enrichment should run.
 */
export function shouldEnrich(): boolean {
  return isLive() || omdbProvider.isConfigured();
}

export function region(): string {
  return process.env.REGION ?? 'IN';
}

function metadata(): MetadataProvider {
  return isLive() && tmdbProvider.isConfigured() ? tmdbProvider : seedProvider;
}

function streaming(): StreamingProvider {
  return isLive() && tmdbProvider.isConfigured() ? tmdbProvider : seedProvider;
}

function ratings(): RatingProvider[] {
  // Order matters: earlier providers win on conflict.
  const list: RatingProvider[] = [];
  if (omdbProvider.isConfigured()) list.push(omdbProvider);
  list.push(seedProvider);
  return list;
}

function reviews(): ReviewProvider[] {
  const list: ReviewProvider[] = [];
  if (isLive() && reviewProvider.isConfigured()) list.push(reviewProvider);
  list.push(seedProvider);
  return list;
}

/** `null` never clobbers a known value. */
function mergeRatings(base: Ratings, incoming: Partial<Ratings> | null): Ratings {
  if (!incoming) return base;
  const out: Ratings = { ...base, sources: { ...base.sources } };
  const keys = [
    'imdbRating',
    'imdbVoteCount',
    'rtCriticScore',
    'rtCriticReviewCount',
    'rtAudienceScore',
    'rtAudienceReviewCount',
    'tmdbScore',
    'tmdbVoteCount',
  ] as const;

  for (const key of keys) {
    const value = incoming[key];
    if (value != null && out[key] == null) {
      out[key] = value;
      const src = incoming.sources?.[key];
      if (src) out.sources[key] = src;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function discoverTitles(query: DiscoverQuery): Promise<Title[]> {
  const provider = metadata();
  try {
    const found = await provider.discover({ ...query, region: query.region || region() });
    if (found.length > 0) return found;
  } catch (err) {
    console.error(`[registry] discover failed on ${provider.id}:`, err);
  }
  // Never leave Dad with an empty screen because an API had a bad night.
  if (provider.id !== 'seed') {
    return seedProvider.discover({ ...query, region: query.region || region() });
  }
  return [];
}

export async function searchTitles(query: SearchQuery): Promise<Title[]> {
  const provider = metadata();
  try {
    const found = await provider.search({ ...query, region: query.region || region() });
    if (found.length > 0) return found;
  } catch (err) {
    console.error(`[registry] search failed on ${provider.id}:`, err);
  }
  return seedProvider.search({ ...query, region: query.region || region() });
}

/**
 * Full enrichment for a single title: metadata, then ratings, then reception,
 * then availability. Used for the four picks and for search detail views —
 * not for the whole candidate pool, which would be needlessly expensive.
 */
export async function enrichTitle(title: Title): Promise<Title> {
  let out = title;

  const meta = metadata();
  if (meta.id !== 'seed') {
    try {
      out = await meta.enrich(out);
    } catch (err) {
      console.error(`[registry] enrich failed on ${meta.id}:`, err);
    }
  }

  // OMDb fills gaps the metadata provider left — most importantly the poster,
  // which means an OMDb key alone is enough to get real artwork.
  if (omdbProvider.isConfigured()) {
    try {
      const meta = await omdbProvider.getMetadata(out);
      if (meta) {
        out = {
          ...out,
          posterUrl: out.posterUrl ?? meta.posterUrl,
          runtimeMinutes: out.runtimeMinutes ?? meta.runtimeMinutes,
          synopsis: out.synopsis ?? meta.synopsis,
          genres: out.genres.length ? out.genres : meta.genres,
          cast: out.cast.length ? out.cast : meta.cast,
          director: out.director ?? meta.director,
          imdbId: out.imdbId ?? meta.imdbId,
          seasons: out.seasons ?? meta.seasons,
        };
      }
    } catch (err) {
      console.error('[registry] omdb metadata failed:', err);
    }
  }

  for (const provider of ratings()) {
    try {
      const partial = await provider.getRatings(out);
      out = { ...out, ratings: mergeRatings(out.ratings, partial) };
    } catch (err) {
      console.error(`[registry] ratings failed on ${provider.id}:`, err);
    }
  }

  if (!out.reception.summary) {
    for (const provider of reviews()) {
      try {
        const reception = await provider.getReception(out);
        if (reception?.summary) {
          out = { ...out, reception };
          break;
        }
      } catch (err) {
        console.error(`[registry] reception failed on ${provider.id}:`, err);
      }
    }
  }

  if (out.availability.length === 0) {
    const stream = streaming();
    try {
      const availability = await stream.getAvailability(out, region());
      if (availability.length) out = { ...out, availability };
    } catch (err) {
      console.error(`[registry] availability failed on ${stream.id}:`, err);
    }
  }

  return out;
}

export async function getTitleById(id: string): Promise<Title | null> {
  const seedHit = await seedProvider.getById(id);
  if (seedHit) return seedHit;

  const meta = metadata();
  if (meta.id === 'seed') return null;
  try {
    const found = await meta.getById(id);
    return found ? enrichTitle(found) : null;
  } catch (err) {
    console.error(`[registry] getById failed on ${meta.id}:`, err);
    return null;
  }
}

export async function providerHealth(): Promise<ProviderHealth[]> {
  const checks = await Promise.all([
    tmdbProvider.health(),
    omdbProvider.health(),
    reviewProvider.health(),
    seedProvider.health(),
  ]);
  return checks;
}

export function activeProviderSummary(): {
  mode: DataMode;
  live: boolean;
  metadata: string;
  streaming: string;
  ratings: string[];
  reviews: string[];
  llm: boolean;
} {
  return {
    mode: dataMode(),
    live: isLive(),
    metadata: metadata().label,
    streaming: streaming().label,
    ratings: ratings().map((p) => p.label),
    reviews: reviews().map((p) => p.label),
    llm: Boolean(process.env.ANTHROPIC_API_KEY),
  };
}
