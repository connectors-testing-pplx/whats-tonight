import { NextResponse } from 'next/server';
import { discoverTitles, enrichTitle, region, shouldEnrich } from '@/lib/providers/registry';

export const dynamic = 'force-dynamic';

/**
 * Titles for the onboarding "have you seen these?" grid.
 *
 * Sorted by vote count rather than rating: the point is to surface what Dad is
 * most likely to have already watched, so the exclusion list gets seeded fast.
 */
export async function GET() {
  try {
    const candidates = await discoverTitles({
      region: region(),
      providers: ['netflix', 'prime', 'jiohotstar'],
      minRating: 7.4,
      limit: 120,
    });

    let results = candidates
      .filter((t) => t.ratings.imdbVoteCount != null)
      .sort((a, b) => (b.ratings.imdbVoteCount ?? 0) - (a.ratings.imdbVoteCount ?? 0))
      .slice(0, 18);

    // Posters matter more here than anywhere — this grid is entirely visual.
    if (shouldEnrich()) {
      const settled = await Promise.allSettled(results.map((t) => enrichTitle(t)));
      results = settled.map((r, i) => (r.status === 'fulfilled' ? r.value : results[i]));
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[api/popular]', err);
    return NextResponse.json({ results: [] });
  }
}
