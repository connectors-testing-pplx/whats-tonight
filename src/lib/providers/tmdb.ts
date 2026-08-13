import {
  NEUTRAL_ATTRIBUTES,
  eraForYear,
  type Availability,
  type Industry,
  type Provider,
  type Title,
  type TitleType,
  type ViewingLanguage,
} from '@/lib/types';
import {
  emptyHealth,
  type DiscoverQuery,
  type MetadataProvider,
  type ProviderHealth,
  type SearchQuery,
  type StreamingProvider,
} from './types';

/**
 * TMDB adapter — metadata, posters and India watch-provider availability.
 *
 * Server-side only. The key is read from process.env and never reaches the
 * browser; all calls originate in /src/app/api route handlers.
 *
 * Docs: https://developer.themoviedb.org/reference/intro/getting-started
 * The /watch/providers endpoints are what make "is this on Netflix India"
 * answerable without scraping anybody.
 */

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

/** TMDB's numeric provider ids for the three platforms we care about. */
const PROVIDER_IDS: Record<number, Provider> = {
  8: 'netflix',
  119: 'prime',
  9: 'prime', // Amazon Prime Video (alternate id used in some regions)
  122: 'jiohotstar', // Hotstar / Disney+ Hotstar / JioHotstar lineage
  2336: 'jiohotstar', // Hotstar (secondary listing)
  970: 'jiohotstar', // JioCinema lineage, merged into JioHotstar
};

const GENRE_CACHE: { movie: Map<number, string>; tv: Map<number, string> } = {
  movie: new Map(),
  tv: new Map(),
};

function apiKey(): string {
  return process.env.TMDB_API_KEY ?? '';
}

/**
 * Simple concurrency gate.
 *
 * Enriching 24 titles fires ~48 requests at once. TMDB tolerates a lot but
 * does rate-limit, and a burst that trips it turns a good evening into an
 * empty screen. Six in flight is well inside their limits and costs maybe a
 * second of wall-clock on a page load that already takes a couple.
 */
const MAX_CONCURRENT = 6;
let inFlight = 0;
const queue: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight += 1;
    return;
  }
  await new Promise<void>((resolve) => queue.push(resolve));
  inFlight += 1;
}

function release(): void {
  inFlight -= 1;
  queue.shift()?.();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  attempt = 0
): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error('TMDB_API_KEY is not set');

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_key', key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  await acquire();
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      // Metadata is stable; availability changes but not by the minute.
      next: { revalidate: 60 * 60 * 6 },
    });
  } finally {
    release();
  }

  // 429 means we were too eager, not that the request was wrong. TMDB sends
  // Retry-After; honour it, then back off. Three tries, then give up so the
  // registry can fall back rather than hanging the page.
  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get('retry-after')) || 1;
    await sleep(retryAfter * 1000 + attempt * 500);
    return tmdbFetch<T>(path, params, attempt + 1);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // 401 is the one worth naming precisely — it is almost always a bad key,
    // and "TMDB 401" alone sends people hunting in the wrong place.
    if (res.status === 401) {
      throw new Error(
        `TMDB rejected the API key (401). Check TMDB_API_KEY is the 32-character "API Key (v3 auth)", not the long Read Access Token.`
      );
    }
    throw new Error(`TMDB ${res.status} on ${path}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function loadGenres(kind: 'movie' | 'tv'): Promise<Map<number, string>> {
  if (GENRE_CACHE[kind].size > 0) return GENRE_CACHE[kind];
  const data = await tmdbFetch<{ genres: { id: number; name: string }[] }>(
    `/genre/${kind}/list`,
    { language: process.env.LOCALE ?? 'en-IN' }
  );
  for (const g of data.genres) GENRE_CACHE[kind].set(g.id, g.name);
  return GENRE_CACHE[kind];
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  kn: 'Kannada',
  bn: 'Bengali',
  mr: 'Marathi',
  pa: 'Punjabi',
  gu: 'Gujarati',
  ur: 'Urdu',
  ko: 'Korean',
  ja: 'Japanese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  zh: 'Chinese',
};

function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

/**
 * Which film industry a title belongs to, inferred from its original language.
 * Crude but effective for the four buckets the UI offers, and TMDB gives us
 * production countries in enrich() to refine it.
 */
function industryFor(originalLanguage: string | undefined): Industry {
  switch (originalLanguage) {
    case 'hi':
      return 'bollywood';
    case 'ta':
    case 'te':
    case 'ml':
    case 'kn':
      return 'south-indian';
    case 'en':
      return 'hollywood';
    case undefined:
      return 'other';
    default:
      return 'international';
  }
}

/**
 * How Papa would watch this.
 *
 * `hindiConfirmed` comes from TMDB's translation list during enrich(). Before
 * that we only know the original language, so a non-Hindi title is marked
 * `english-only-unverified` rather than `english-only` — we genuinely do not
 * know yet, and the UI says so instead of overclaiming.
 */
function viewingLanguageFor(
  originalLanguage: string | undefined,
  hindiConfirmed: boolean
): ViewingLanguage {
  if (originalLanguage === 'hi') return 'hindi';
  if (hindiConfirmed) return 'hindi-dubbed';
  if (originalLanguage === 'en') return 'english-only-unverified';
  return 'other-language';
}

interface TmdbListItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  genre_ids?: number[];
  original_language?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
}

async function toTitle(item: TmdbListItem, kind: 'movie' | 'tv'): Promise<Title> {
  const genreMap = await loadGenres(kind);
  const dateStr = item.release_date || item.first_air_date || '';
  const year = dateStr ? Number(dateStr.slice(0, 4)) : null;
  const lang = languageName(item.original_language);

  return {
    id: `tmdb:${kind}:${item.id}`,
    tmdbId: item.id,
    imdbId: null,
    title: item.title || item.name || 'Untitled',
    type: kind === 'movie' ? 'movie' : 'series',
    releaseYear: Number.isFinite(year) ? year : null,
    posterUrl: item.poster_path ? `${IMG}/w500${item.poster_path}` : null,
    backdropUrl: item.backdrop_path ? `${IMG}/w780${item.backdrop_path}` : null,
    synopsis: item.overview || null,
    genres: (item.genre_ids ?? [])
      .map((id) => genreMap.get(id))
      .filter((g): g is string => Boolean(g)),
    subgenres: [],
    themes: [],
    languages: lang ? [lang] : [],
    // Dub availability isn't known until enrich() reads the translation list.
    viewingLanguage: viewingLanguageFor(item.original_language, false),
    era: eraForYear(Number.isFinite(year) ? year : null),
    industry: industryFor(item.original_language),
    attributes: { ...NEUTRAL_ATTRIBUTES },
    runtimeMinutes: null,
    seasons: null,
    episodes: null,
    ratings: {
      imdbRating: null,
      imdbVoteCount: null,
      rtCriticScore: null,
      rtCriticReviewCount: null,
      rtAudienceScore: null,
      rtAudienceReviewCount: null,
      tmdbScore: item.vote_average ?? null,
      tmdbVoteCount: item.vote_count ?? null,
      sources: { tmdbScore: 'tmdb', tmdbVoteCount: 'tmdb' },
    },
    reception: {
      summary: null,
      themes: [],
      evidenceCount: null,
      evidenceSources: [],
      generatedAt: null,
      llmGenerated: false,
    },
    availability: [],
    trending: null,
    cast: [],
    director: null,
    lastUpdated: new Date().toISOString(),
    primarySource: 'tmdb',
  };
}

function parseId(id: string): { kind: 'movie' | 'tv'; tmdbId: number } | null {
  const m = /^tmdb:(movie|tv):(\d+)$/.exec(id);
  if (!m) return null;
  return { kind: m[1] as 'movie' | 'tv', tmdbId: Number(m[2]) };
}

class TmdbProvider implements MetadataProvider, StreamingProvider {
  readonly id = 'tmdb';
  readonly label = 'TMDB';

  isConfigured(): boolean {
    return Boolean(apiKey());
  }

  async health(): Promise<ProviderHealth> {
    const configured = this.isConfigured();
    const base = emptyHealth(
      this.id,
      'metadata',
      this.label,
      configured,
      configured
        ? 'Metadata, posters and India watch-provider availability.'
        : 'TMDB_API_KEY not set — falling back to the packaged catalogue.'
    );
    if (!configured) return base;
    try {
      await tmdbFetch('/configuration');
      return { ...base, reachable: true, lastCheckedAt: new Date().toISOString() };
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
   * Discovery is run per-platform so we get a pool that is actually watchable
   * in India tonight, rather than a global popularity list.
   */
  async discover(query: DiscoverQuery): Promise<Title[]> {
    const region = query.region || 'IN';
    const wanted = query.providers.length
      ? query.providers
      : ['netflix', 'prime', 'jiohotstar'];

    const tmdbIdsFor = (p: string): number[] =>
      Object.entries(PROVIDER_IDS)
        .filter(([, v]) => v === p)
        .map(([k]) => Number(k));

    const providerParam = wanted.flatMap(tmdbIdsFor).join('|');
    const kinds: ('movie' | 'tv')[] =
      query.type === 'movie' ? ['movie'] : query.type === 'series' ? ['tv'] : ['movie', 'tv'];

    const results: Title[] = [];
    for (const kind of kinds) {
      // Two pages per kind gives the ranker a pool of ~80 without hammering the API.
      for (const page of [1, 2]) {
        const data = await tmdbFetch<{ results: TmdbListItem[] }>(
          `/discover/${kind}`,
          {
            watch_region: region,
            with_watch_providers: providerParam,
            with_watch_monetization_types: 'flatrate',
            sort_by: 'vote_average.desc',
            'vote_count.gte': query.minVotes ?? 300,
            'vote_average.gte': query.minRating ?? 6.8,
            page,
            language: process.env.LOCALE ?? 'en-IN',
          }
        );
        for (const item of data.results) results.push(await toTitle(item, kind));
      }
    }
    return query.limit ? results.slice(0, query.limit) : results;
  }

  async search({ query, limit = 30 }: SearchQuery): Promise<Title[]> {
    const data = await tmdbFetch<{ results: (TmdbListItem & { media_type: string })[] }>(
      '/search/multi',
      { query, include_adult: 'false', language: process.env.LOCALE ?? 'en-IN' }
    );
    const out: Title[] = [];
    for (const item of data.results) {
      if (item.media_type === 'movie') out.push(await toTitle(item, 'movie'));
      else if (item.media_type === 'tv') out.push(await toTitle(item, 'tv'));
      // media_type === 'person' is handled below via known_for
      else if (item.media_type === 'person') {
        const person = item as unknown as { known_for?: TmdbListItem[] };
        for (const k of person.known_for ?? []) {
          const kind = k.title ? 'movie' : 'tv';
          out.push(await toTitle(k, kind));
        }
      }
    }
    // De-duplicate; a person search can surface the same title twice.
    const seen = new Set<string>();
    return out.filter((t) => !seen.has(t.id) && seen.add(t.id)).slice(0, limit);
  }

  /** Runtime, cast, director, IMDb id, season counts, and availability. */
  async enrich(title: Title): Promise<Title> {
    const parsed = parseId(title.id);
    if (!parsed) return title;
    const { kind, tmdbId } = parsed;

    const detail = await tmdbFetch<{
      runtime?: number;
      episode_run_time?: number[];
      number_of_seasons?: number;
      number_of_episodes?: number;
      external_ids?: { imdb_id?: string | null };
      credits?: {
        cast?: { name: string }[];
        crew?: { name: string; job: string }[];
      };
      spoken_languages?: { english_name: string }[];
      genres?: { id: number; name: string }[];
      translations?: { translations?: { iso_639_1: string }[] };
      original_language?: string;
      production_countries?: { iso_3166_1: string }[];
    }>(`/${kind}/${tmdbId}`, {
      append_to_response: 'external_ids,credits,translations',
      language: process.env.LOCALE ?? 'en-IN',
    });

    const runtime =
      kind === 'movie'
        ? detail.runtime ?? null
        : detail.episode_run_time?.[0] ?? null;

    const director =
      detail.credits?.crew?.find((c) => c.job === 'Director')?.name ?? null;

    const languages = detail.spoken_languages?.length
      ? detail.spoken_languages.map((l) => l.english_name)
      : title.languages;

    const availability = await this.getAvailability(
      { ...title, tmdbId },
      process.env.REGION ?? 'IN'
    );

    // A Hindi entry in the translation list is the best signal TMDB gives us
    // that a Hindi track exists. It is not a guarantee that this particular
    // platform carries it, which is why the label stays honest about doubt.
    const hindiTranslation = Boolean(
      detail.translations?.translations?.some((t) => t.iso_639_1 === 'hi')
    );
    const original = detail.original_language ?? undefined;

    return {
      ...title,
      viewingLanguage:
        original === 'hi'
          ? 'hindi'
          : hindiTranslation
            ? 'hindi-dubbed'
            : title.viewingLanguage,
      imdbId: detail.external_ids?.imdb_id ?? null,
      runtimeMinutes: runtime,
      seasons: detail.number_of_seasons ?? null,
      episodes: detail.number_of_episodes ?? null,
      genres: detail.genres?.length ? detail.genres.map((g) => g.name) : title.genres,
      languages,
      cast: (detail.credits?.cast ?? []).slice(0, 5).map((c) => c.name),
      director,
      availability,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getById(id: string): Promise<Title | null> {
    const parsed = parseId(id);
    if (!parsed) return null;
    const { kind, tmdbId } = parsed;
    const item = await tmdbFetch<TmdbListItem>(`/${kind}/${tmdbId}`, {
      language: process.env.LOCALE ?? 'en-IN',
    });
    const base = await toTitle({ ...item, genre_ids: [] }, kind);
    return this.enrich({ ...base, id });
  }

  async getAvailability(title: Title, region: string): Promise<Availability[]> {
    const parsed = parseId(title.id);
    const tmdbId = title.tmdbId ?? parsed?.tmdbId;
    const kind = parsed?.kind ?? (title.type === 'movie' ? 'movie' : 'tv');
    if (!tmdbId) return [];

    const data = await tmdbFetch<{
      results: Record<
        string,
        {
          link?: string;
          flatrate?: { provider_id: number; provider_name: string }[];
        }
      >;
    }>(`/${kind}/${tmdbId}/watch/providers`);

    const forRegion = data.results?.[region];
    if (!forRegion?.flatrate) return [];

    const out = new Map<Provider, Availability>();
    for (const entry of forRegion.flatrate) {
      const mapped = PROVIDER_IDS[entry.provider_id];
      if (!mapped) continue;
      // Only report what the source actually confirms.
      out.set(mapped, {
        provider: mapped,
        country: region,
        streamingUrl: forRegion.link ?? null,
        lastChecked: new Date().toISOString(),
        source: 'tmdb',
      });
    }
    return [...out.values()];
  }
}

export const tmdbProvider = new TmdbProvider();
export const TMDB_TYPE_MAP: Record<TitleType, 'movie' | 'tv'> = {
  movie: 'movie',
  series: 'tv',
  'limited-series': 'tv',
};
