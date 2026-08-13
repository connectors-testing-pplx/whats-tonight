import { SEED_TITLES } from '@/lib/data/seed-titles';
import type { Availability, Ratings, Reception, Title } from '@/lib/types';
import {
  emptyHealth,
  type DiscoverQuery,
  type MetadataProvider,
  type ProviderHealth,
  type RatingProvider,
  type ReviewProvider,
  type SearchQuery,
  type StreamingProvider,
} from './types';

/**
 * The offline fallback. Implements all four interfaces against the packaged
 * catalogue so the app is fully functional with zero configuration.
 *
 * It never fabricates: it returns exactly what is in seed-titles.ts, nulls and
 * all, and reports itself as seed-sourced so /admin can say so honestly.
 */

const NOTE =
  'Packaged starter catalogue. Ratings are point-in-time snapshots and availability is indicative, not verified. Add TMDB/OMDb keys for live data.';

function health(kind: ProviderHealth['kind']): ProviderHealth {
  return {
    ...emptyHealth('seed', kind, 'Packaged catalogue', true, NOTE),
    reachable: true,
    lastCheckedAt: new Date().toISOString(),
  };
}

function matchesProviders(title: Title, providers: string[]): boolean {
  if (providers.length === 0) return true;
  return title.availability.some((a) => providers.includes(a.provider));
}

class SeedProvider
  implements MetadataProvider, RatingProvider, ReviewProvider, StreamingProvider
{
  readonly id = 'seed';
  readonly label = 'Packaged catalogue';

  isConfigured(): boolean {
    return true;
  }

  async health(): Promise<ProviderHealth> {
    return health('metadata');
  }

  async discover(query: DiscoverQuery): Promise<Title[]> {
    let pool = SEED_TITLES.filter((t) => matchesProviders(t, query.providers));

    if (query.minRating != null) {
      pool = pool.filter(
        (t) => t.ratings.imdbRating == null || t.ratings.imdbRating >= query.minRating!
      );
    }
    if (query.minVotes != null) {
      pool = pool.filter(
        (t) =>
          t.ratings.imdbVoteCount == null ||
          t.ratings.imdbVoteCount >= query.minVotes!
      );
    }
    if (query.type) {
      pool = pool.filter((t) => t.type === query.type);
    }
    if (query.languages?.length) {
      pool = pool.filter((t) =>
        t.languages.some((l) => query.languages!.includes(l))
      );
    }
    return query.limit ? pool.slice(0, query.limit) : pool;
  }

  async search({ query, limit = 30 }: SearchQuery): Promise<Title[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const scored = SEED_TITLES.map((t) => {
      let score = 0;
      const title = t.title.toLowerCase();
      if (title === q) score += 100;
      else if (title.startsWith(q)) score += 60;
      else if (title.includes(q)) score += 40;

      if (t.cast.some((c) => c.toLowerCase().includes(q))) score += 30;
      if (t.director?.toLowerCase().includes(q)) score += 25;
      if (t.genres.some((g) => g.toLowerCase().includes(q))) score += 18;
      if (t.languages.some((l) => l.toLowerCase() === q)) score += 15;
      if (t.synopsis?.toLowerCase().includes(q)) score += 5;

      return { t, score };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (b.t.ratings.imdbRating ?? 0) - (a.t.ratings.imdbRating ?? 0));

    return scored.slice(0, limit).map((x) => x.t);
  }

  async enrich(title: Title): Promise<Title> {
    const seed = SEED_TITLES.find((t) => t.id === title.id);
    return seed ?? title;
  }

  async getById(id: string): Promise<Title | null> {
    return SEED_TITLES.find((t) => t.id === id) ?? null;
  }

  async getRatings(title: Title): Promise<Partial<Ratings> | null> {
    const seed = SEED_TITLES.find((t) => t.id === title.id);
    return seed?.ratings ?? null;
  }

  async getReception(title: Title): Promise<Reception | null> {
    const seed = SEED_TITLES.find((t) => t.id === title.id);
    return seed?.reception ?? null;
  }

  async getAvailability(title: Title, region: string): Promise<Availability[]> {
    const seed = SEED_TITLES.find((t) => t.id === title.id);
    if (!seed) return [];
    return seed.availability.filter((a) => a.country === region);
  }
}

export const seedProvider = new SeedProvider();
