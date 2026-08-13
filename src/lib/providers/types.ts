import type {
  Availability,
  Ratings,
  Reception,
  Title,
  TitleType,
} from '@/lib/types';

/**
 * The four provider interfaces the whole application is built against.
 *
 * Nothing above this layer knows whether data came from TMDB, OMDb, a licensed
 * ratings feed, or the packaged seed catalogue. Swapping a source means writing
 * one adapter and registering it — no changes to the engine or the UI.
 *
 * Every method returns `null` (or empty) rather than throwing when a fact is
 * simply unknown. Callers treat that as "not available" and the card renders
 * accordingly. Adapters throw only for genuine failures — a dead key, a
 * network error — so the registry can fall back and the admin view can report.
 */

export interface ProviderHealth {
  id: string;
  kind: 'metadata' | 'rating' | 'review' | 'streaming';
  label: string;
  configured: boolean;
  reachable: boolean | null;
  lastCheckedAt: string | null;
  note: string;
}

export interface DiscoverQuery {
  region: string;
  providers: string[];
  /** Nudges the discovery window; the ranker does the real work. */
  minRating?: number;
  minVotes?: number;
  languages?: string[];
  type?: TitleType;
  limit?: number;
}

export interface SearchQuery {
  query: string;
  region: string;
  limit?: number;
}

/**
 * Posters, genres, runtime, language, release info, cast.
 * TMDB is the reference implementation.
 */
export interface MetadataProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  health(): Promise<ProviderHealth>;

  /** Broad candidate discovery. Returns partially-filled titles. */
  discover(query: DiscoverQuery): Promise<Title[]>;

  /** Free-text search across titles, people and genres. */
  search(query: SearchQuery): Promise<Title[]>;

  /** Fill in everything this source knows about one title. */
  enrich(title: Title): Promise<Title>;

  getById(id: string): Promise<Title | null>;
}

/**
 * IMDb rating + vote count, Rotten Tomatoes scores.
 *
 * A note on Rotten Tomatoes: RT has no public API, and their official one is
 * restricted to licensed partners. This app therefore does not scrape RT. The
 * OMDb adapter surfaces the RT *critics* score that OMDb legitimately passes
 * through; the RT *audience* score has no free legitimate source, so it stays
 * null and the UI prints "Not available". If you later license a proper RT
 * feed, write one adapter against this interface and register it — nothing
 * else in the codebase changes.
 */
export interface RatingProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  health(): Promise<ProviderHealth>;
  getRatings(title: Title): Promise<Partial<Ratings> | null>;
}

/** Review/reception evidence, and the summary derived from it. */
export interface ReviewProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  health(): Promise<ProviderHealth>;
  getReception(title: Title): Promise<Reception | null>;
}

/** Which platforms carry the title, in a given country. */
export interface StreamingProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  health(): Promise<ProviderHealth>;
  getAvailability(title: Title, region: string): Promise<Availability[]>;
}

export function emptyHealth(
  id: string,
  kind: ProviderHealth['kind'],
  label: string,
  configured: boolean,
  note: string
): ProviderHealth {
  return {
    id,
    kind,
    label,
    configured,
    reachable: null,
    lastCheckedAt: null,
    note,
  };
}
