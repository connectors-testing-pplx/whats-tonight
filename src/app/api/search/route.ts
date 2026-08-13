import { NextResponse } from 'next/server';
import {
  enrichTitle,
  region,
  shouldEnrich,
  searchTitles,
} from '@/lib/providers/registry';
import type { Title } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Search across titles, cast, directors and genres.
 *
 * Results are enriched shallowly — only the first page gets ratings and
 * reception, because search is browsed rather than read end to end.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim();

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const found = await searchTitles({ query, region: region(), limit: 24 });

    let results: Title[] = found;
    if (shouldEnrich()) {
      const head = found.slice(0, 10);
      const tail = found.slice(10);
      const settled = await Promise.allSettled(head.map((t) => enrichTitle(t)));
      results = [
        ...settled.map((r, i) => (r.status === 'fulfilled' ? r.value : head[i])),
        ...tail,
      ];
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[api/search]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed', results: [] },
      { status: 500 }
    );
  }
}
