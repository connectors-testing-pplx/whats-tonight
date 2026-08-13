import type { Ratings, Title } from '@/lib/types';
import {
  emptyHealth,
  type ProviderHealth,
  type RatingProvider,
} from './types';

/**
 * OMDb adapter — IMDb rating and vote count, plus the Rotten Tomatoes CRITICS
 * score where OMDb carries it.
 *
 * Why this and not a scraper:
 *   - IMDb has no free public ratings API. OMDb is a long-running service that
 *     redistributes IMDb data under its own terms, which is the practical
 *     legitimate route for a personal project.
 *   - Rotten Tomatoes' own API is restricted to licensed partners. OMDb passes
 *     through an RT critics percentage for many titles; that is the only RT
 *     figure this adapter will ever report.
 *   - The RT AUDIENCE score has no free legitimate source. This adapter leaves
 *     it null, permanently and on purpose. The UI prints "Not available".
 *     If you later license a real RT feed, implement RatingProvider against it
 *     and register it ahead of this one — nothing else changes.
 *
 * Free tier: 1,000 requests/day. https://www.omdbapi.com/apikey.aspx
 */

const BASE = 'https://www.omdbapi.com/';

function apiKey(): string {
  return process.env.OMDB_API_KEY ?? '';
}

interface OmdbResponse {
  Response: 'True' | 'False';
  Error?: string;
  Title?: string;
  Year?: string;
  imdbRating?: string;
  imdbVotes?: string;
  imdbID?: string;
  Ratings?: { Source: string; Value: string }[];
  Runtime?: string;
  Metascore?: string;
  /** IMDb's own poster image, served from Amazon's CDN. */
  Poster?: string;
  Plot?: string;
  Genre?: string;
  Actors?: string;
  Director?: string;
  Language?: string;
  Type?: string;
  totalSeasons?: string;
}

/** Fields OMDb can fill in beyond ratings. Posters are the valuable one. */
export interface OmdbMetadata {
  posterUrl: string | null;
  runtimeMinutes: number | null;
  synopsis: string | null;
  genres: string[];
  cast: string[];
  director: string | null;
  imdbId: string | null;
  seasons: number | null;
}

function parseNumber(value: string | undefined): number | null {
  if (!value || value === 'N/A') return null;
  const n = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseVotes(value: string | undefined): number | null {
  if (!value || value === 'N/A') return null;
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function splitList(value: string | undefined): string[] {
  if (!value || value === 'N/A') return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

function extractRt(ratings: OmdbResponse['Ratings']): number | null {
  const rt = ratings?.find((r) => r.Source === 'Rotten Tomatoes');
  if (!rt) return null;
  const n = Number(rt.Value.replace('%', ''));
  return Number.isFinite(n) ? n : null;
}

class OmdbProvider implements RatingProvider {
  readonly id = 'omdb';
  readonly label = 'OMDb (IMDb + RT critics)';

  isConfigured(): boolean {
    return Boolean(apiKey());
  }

  async health(): Promise<ProviderHealth> {
    const configured = this.isConfigured();
    const base = emptyHealth(
      this.id,
      'rating',
      this.label,
      configured,
      configured
        ? 'IMDb rating and votes; RT critics score where carried. RT audience is never available here.'
        : 'OMDB_API_KEY not set — IMDb and RT figures will show as "Not available" unless the packaged catalogue has them.'
    );
    if (!configured) return base;
    try {
      const res = await fetch(`${BASE}?apikey=${apiKey()}&i=tt0903747`);
      const json = (await res.json()) as OmdbResponse;
      return {
        ...base,
        reachable: json.Response === 'True',
        lastCheckedAt: new Date().toISOString(),
        note: json.Response === 'True' ? base.note : json.Error ?? 'Rejected',
      };
    } catch (err) {
      return {
        ...base,
        reachable: false,
        lastCheckedAt: new Date().toISOString(),
        note: err instanceof Error ? err.message : 'Unreachable',
      };
    }
  }

  /**
   * One request serves both ratings and metadata — OMDb returns everything in
   * a single payload, and the free tier is 1,000 calls a day. Results are
   * cached for a day by the fetch layer so a page refresh costs nothing.
   */
  private async lookup(title: Title): Promise<OmdbResponse | null> {
    if (!this.isConfigured()) return null;

    // Prefer the IMDb id — matching by title and year is guesswork.
    const url = new URL(BASE);
    url.searchParams.set('apikey', apiKey());
    if (title.imdbId) {
      url.searchParams.set('i', title.imdbId);
    } else {
      url.searchParams.set('t', title.title);
      if (title.releaseYear) url.searchParams.set('y', String(title.releaseYear));
      url.searchParams.set('type', title.type === 'movie' ? 'movie' : 'series');
    }

    try {
      const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 } });
      if (!res.ok) return null;
      const json = (await res.json()) as OmdbResponse;
      return json.Response === 'True' ? json : null;
    } catch {
      return null;
    }
  }

  /**
   * Posters, runtime, cast and plot.
   *
   * Worth calling out: the `Poster` field is IMDb's own artwork, served from
   * Amazon's CDN and handed over by OMDb legitimately. That means an OMDb key
   * alone is enough to get real posters — TMDB is not required for artwork,
   * only for India availability.
   */
  async getMetadata(title: Title): Promise<OmdbMetadata | null> {
    const json = await this.lookup(title);
    if (!json) return null;

    const poster = json.Poster && json.Poster !== 'N/A' ? json.Poster : null;
    const seasons = json.totalSeasons ? parseNumber(json.totalSeasons) : null;

    return {
      posterUrl: poster,
      runtimeMinutes: parseNumber(json.Runtime),
      synopsis: json.Plot && json.Plot !== 'N/A' ? json.Plot : null,
      genres: splitList(json.Genre),
      cast: splitList(json.Actors),
      director: json.Director && json.Director !== 'N/A' ? json.Director : null,
      imdbId: json.imdbID ?? null,
      seasons: seasons != null ? Math.round(seasons) : null,
    };
  }

  async getRatings(title: Title): Promise<Partial<Ratings> | null> {
    const json = await this.lookup(title);
    if (!json) return null;

    const imdbRating = parseNumber(json.imdbRating);
    const imdbVoteCount = parseVotes(json.imdbVotes);
    const rtCriticScore = extractRt(json.Ratings);

    return {
      imdbRating,
      imdbVoteCount,
      rtCriticScore,
      // OMDb does not carry a review count for RT, and inventing one would
      // misrepresent how much weight the percentage deserves.
      rtCriticReviewCount: null,
      rtAudienceScore: null,
      rtAudienceReviewCount: null,
      sources: {
        imdbRating: imdbRating != null ? 'omdb' : 'unknown',
        imdbVoteCount: imdbVoteCount != null ? 'omdb' : 'unknown',
        rtCriticScore: rtCriticScore != null ? 'omdb' : 'unknown',
      },
    };
  }
}

export const omdbProvider = new OmdbProvider();
