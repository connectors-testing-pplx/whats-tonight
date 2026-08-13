import { NextResponse } from 'next/server';
import { generatePicks } from '@/lib/engine';
import {
  activeProviderSummary,
  discoverTitles,
  enrichTitle,
  region,
  shouldEnrich,
} from '@/lib/providers/registry';
import type { AppState, SessionRequest, Title } from '@/lib/types';
import { interpretQuery } from '@/lib/engine/nlq';
import { migrate } from '@/lib/store/adapter';

export const dynamic = 'force-dynamic';

/**
 * The recommendation endpoint.
 *
 * Runs server-side so provider API keys never reach the browser. The client
 * posts its own state (which lives on the device) and gets back four fully
 * explained picks.
 *
 * Cost control: discovery returns a broad pool, but only the top slice is
 * deep-enriched with ratings and reception. Enriching eighty titles to show
 * four would burn the OMDb daily quota in a handful of page loads.
 */

const ENRICH_DEPTH = 24;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      state: Partial<AppState>;
      request?: Partial<SessionRequest>;
      revision?: number;
      excludeIds?: string[];
      date?: string;
    };

    const state = migrate(body.state ?? {});
    let sessionRequest = body.request ?? {};
    let queryThemes: string[] = [];

    // A typed request is interpreted into structured criteria first — the LLM,
    // if configured, translates the sentence. It never names a title.
    if (sessionRequest.query) {
      const interpreted = await interpretQuery(sessionRequest.query);
      sessionRequest = {
        ...interpreted.request,
        ...sessionRequest,
        // Merge rather than overwrite: explicit chips win, parsed hints fill gaps.
        genres: [...new Set([...(interpreted.request.genres ?? []), ...(sessionRequest.genres ?? [])])],
        eras: [...new Set([...(interpreted.request.eras ?? []), ...(sessionRequest.eras ?? [])])],
        industries: [...new Set([...(interpreted.request.industries ?? []), ...(sessionRequest.industries ?? [])])],
        mood: sessionRequest.mood ?? interpreted.request.mood,
        discoveryMode: Boolean(sessionRequest.discoveryMode || interpreted.request.discoveryMode),
      };
      queryThemes = interpreted.themes;
    }

    // ------------------------------------------------------------ DISCOVER
    const candidates = await discoverTitles({
      region: region(),
      providers: sessionRequest.providers?.length
        ? sessionRequest.providers
        : state.preferences.providers,
      minRating: 6.4,
      minVotes: 200,
      limit: 160,
    });

    // -------------------------------------------------------------- ENRICH
    // Runs whenever ANY live provider is configured — OMDb alone brings real
    // posters, ratings, runtimes and cast even without TMDB.
    let enriched: Title[] = candidates;
    if (shouldEnrich()) {
      const head = candidates.slice(0, ENRICH_DEPTH);
      const tail = candidates.slice(ENRICH_DEPTH);
      const results = await Promise.allSettled(head.map((t) => enrichTitle(t)));
      enriched = [
        ...results.map((r, i) => (r.status === 'fulfilled' ? r.value : head[i])),
        ...tail,
      ];
    }

    // --------------------------------------------- FILTER / RANK / EXPLAIN
    const picks = generatePicks({
      state,
      candidates: enriched,
      request: sessionRequest,
      queryThemes,
      date: body.date,
      revision: body.revision,
      excludeIds: body.excludeIds,
    });

    const summary = activeProviderSummary();

    return NextResponse.json({
      picks,
      dataMode: {
        live: summary.live,
        note: summary.live
          ? `Live data via ${summary.metadata}${summary.ratings.length ? ` and ${summary.ratings[0]}` : ''}.`
          : 'Running on the packaged starter catalogue. Availability is indicative, not verified — add a TMDB key for live data.',
      },
    });
  } catch (err) {
    console.error('[api/recommendations]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
