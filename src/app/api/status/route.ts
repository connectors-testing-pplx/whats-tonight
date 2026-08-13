import { NextResponse } from 'next/server';
import {
  activeProviderSummary,
  dataMode,
  providerHealth,
  region,
} from '@/lib/providers/registry';
import { SEED_TITLES, catalogueBreakdown } from '@/lib/data/seed-titles';
import { PROFILE_CONFIG, INTERACTION_WEIGHTS } from '@/lib/engine/profile';
import {
  MAYBE_LATER_COOLDOWN_DAYS,
  SHOWN_COOLDOWN_DAYS,
} from '@/lib/engine/filter';
import { RANK_COMPONENTS } from '@/lib/engine/rank';

export const dynamic = 'force-dynamic';

/** Powers the developer dashboard at /admin. Not linked from the user UI. */
export async function GET(request: Request) {
  const token = process.env.ADMIN_TOKEN;
  if (token) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('key') !== token) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
  }

  const health = await providerHealth();
  const summary = activeProviderSummary();

  return NextResponse.json({
    dataMode: dataMode(),
    region: region(),
    live: summary.live,
    active: summary,
    providers: health,
    catalogue: {
      ...catalogueBreakdown(),
      withImdb: SEED_TITLES.filter((t) => t.ratings.imdbRating != null).length,
      withRtCritics: SEED_TITLES.filter((t) => t.ratings.rtCriticScore != null).length,
      withRtAudience: SEED_TITLES.filter((t) => t.ratings.rtAudienceScore != null).length,
      withReception: SEED_TITLES.filter((t) => t.reception.summary != null).length,
    },
    engine: {
      rankComponents: RANK_COMPONENTS,
      maybeLaterCooldownDays: MAYBE_LATER_COOLDOWN_DAYS,
      shownCooldownDays: SHOWN_COOLDOWN_DAYS,
      profile: PROFILE_CONFIG,
      interactionWeights: INTERACTION_WEIGHTS,
    },
    checkedAt: new Date().toISOString(),
  });
}
