import {
  EMPTY_REQUEST,
  type AppState,
  type PickSet,
  type Recommendation,
  type SessionRequest,
  type Title,
} from '@/lib/types';
import { computeConsensus } from '@/lib/utils/consensus';
import { localDateKey } from '@/lib/utils/format';
import { setDiversity } from './diversify';
import { buildReasons, buildWhyWePicked } from './explain';
import { filterCandidates } from './filter';
import { themeMatchScore } from './nlq';
import { buildProfile, type BehaviouralProfile } from './profile';
import { makeRng } from './random';
import { rankCandidates, type RankContext, type ScoredTitle } from './rank';
import { assignSlots } from './slots';

export * from './filter';
export * from './rank';
export * from './profile';
export * from './diversify';
export * from './language';
export * from './vector';
export * from './nlq';

/**
 * The pipeline, end to end.
 *
 *   INTERPRET  what he asked for tonight
 *   DISCOVER   across every platform, era and industry
 *   FILTER     seen, rejected, unavailable, out of scope, below the bar
 *   RANK       quality · mood · language · profile · discovery · trending
 *   DIVERSIFY  four to six that are genuinely different from each other
 *   EXPLAIN    why each one, in words, from data we actually hold
 *
 * What it deliberately does NOT do: ask a language model to name some films.
 * The model's only jobs are interpreting a typed request and phrasing review
 * evidence — both downstream of every decision that matters.
 */

export interface GenerateOptions {
  state: AppState;
  candidates: Title[];
  request?: Partial<SessionRequest>;
  /** Semantic themes pulled from a typed query. */
  queryThemes?: string[];
  date?: string;
  revision?: number;
  now?: Date;
  excludeIds?: string[];
  /** Force a specific count; otherwise the engine decides 4-6. */
  count?: number;
}

export function generatePicks(options: GenerateOptions): PickSet {
  const now = options.now ?? new Date();
  const date = options.date ?? localDateKey(now);
  const revision = options.revision ?? 0;
  const { state, candidates } = options;

  const request: SessionRequest = {
    ...EMPTY_REQUEST,
    languagePreference: state.preferences.languagePreference,
    providers: state.preferences.providers,
    ...options.request,
  };

  const notes: string[] = [];

  // ------------------------------------------------------------ 1. PROFILE
  // Built from everything he has ever done, but only trusted once there is
  // enough of it. See profile.ts for the cold-start reasoning.
  const catalogue = new Map<string, Title>();
  for (const t of candidates) catalogue.set(t.id, t);
  for (const [id, t] of Object.entries(state.titleCache)) {
    if (!catalogue.has(id)) catalogue.set(id, t);
  }
  const profile = buildProfile(state, catalogue, now);
  notes.push(...profile.notes);

  // ------------------------------------------------------------- 2. FILTER
  const filtered = filterCandidates(candidates, {
    state,
    request,
    now,
    excludeIds: options.excludeIds ? new Set(options.excludeIds) : undefined,
  });

  for (const [reason, count] of Object.entries(filtered.rejections)) {
    notes.push(`${count} filtered — ${reason.toLowerCase()}`);
  }

  let pool = filtered.kept;
  let recyclable = filtered.recyclable;

  // If the filters were too aggressive to fill even four slots, relax the
  // SOFT constraints only — recently-shown and Maybe Later cooldowns. The hard
  // rules (seen, rejected, availability, what he asked for) never bend.
  if (pool.length < 4) {
    notes.push('Pool too small — relaxing the recently-shown and cooldown rules.');
    const relaxed = filterCandidates(candidates, {
      state,
      request,
      now,
      excludeIds: options.excludeIds ? new Set(options.excludeIds) : undefined,
      relaxed: true,
    });
    pool = relaxed.kept;
    recyclable = relaxed.recyclable;
  }

  // Still nothing? Drop the session filters rather than show an empty screen,
  // and say so in the notes so /admin can see it happened.
  if (pool.length === 0 && (request.genres.length || request.eras.length || request.industries.length)) {
    notes.push('Nothing matched those filters — widened the search.');
    const widened = filterCandidates(candidates, {
      state,
      request: { ...request, genres: [], eras: [], industries: [], formats: [] },
      now,
      relaxed: true,
    });
    pool = widened.kept;
    recyclable = widened.recyclable;
  }

  // --------------------------------------------------------------- 3. RANK
  const seedTitle = request.similarToId ? catalogue.get(request.similarToId) ?? null : null;

  const ctx: RankContext = { request, profile, seedTitle, now };
  let ranked = rankCandidates(pool, ctx);

  // Semantic bonus from a typed query — "a mystery with a shocking twist"
  // lifts titles tagged with twist endings even if the words never matched.
  if (options.queryThemes?.length) {
    ranked = ranked
      .map((r) => {
        const bonus = themeMatchScore(r.title.themes, options.queryThemes!) * 14;
        return {
          ...r,
          score: r.score + bonus,
          breakdown: { ...r.breakdown, themeMatch: Math.round(bonus * 10) / 10 },
        };
      })
      .sort((a, b) => b.score - a.score);
    notes.push(`Semantic themes applied: ${options.queryThemes.join(', ')}`);
  }

  // ------------------------------------------------- 4. SLOTS + DIVERSITY
  const rng = makeRng(date, revision, request.mood ?? 'any', request.query ?? '');
  const { assignments, note: countNote } = assignSlots(ranked, rng, {
    recyclable,
    count: options.count,
    request,
  });
  notes.push(countNote);

  // ------------------------------------------------------------ 5. EXPLAIN
  const recommendations: Recommendation[] = assignments.map((a) => {
    const explainCtx = {
      slot: a.slot,
      request,
      slotReason: a.slotReason,
      languageException: a.scored.languageException,
      languageReason: a.scored.languageReason,
      profile,
    };
    return {
      slot: a.slot,
      title: a.scored.title,
      score: Math.round(a.scored.score * 10) / 10,
      scoreBreakdown: Object.fromEntries(
        Object.entries(a.scored.breakdown).map(([k, v]) => [k, Math.round(v * 10) / 10])
      ),
      consensus: computeConsensus(a.scored.title),
      whyWePicked: buildWhyWePicked(a.scored, explainCtx),
      reasons: buildReasons(a.scored, explainCtx),
      languageException: a.scored.languageException,
    };
  });

  const diversity = setDiversity(recommendations.map((r) => r.title));
  notes.push(`Set diversity ${(diversity * 100).toFixed(0)}%`);

  const hindiCount = recommendations.filter((r) =>
    ['hindi', 'hindi-dubbed', 'hindi-and-english'].includes(r.title.viewingLanguage)
  ).length;
  notes.push(`${hindiCount}/${recommendations.length} available in Hindi`);

  const exceptions = recommendations.filter((r) => r.languageException).length;
  if (exceptions) notes.push(`${exceptions} English-only title(s) earned the exception`);

  return {
    date,
    revision,
    request,
    recommendations,
    generatedAt: now.toISOString(),
    poolSize: pool.length,
    notes,
    profileConfidence: profile.confidence,
  };
}

/** Ranked "more like this", used by the Find Similar action. */
export function findSimilarTitles(
  seedId: string,
  candidates: Title[],
  state: AppState,
  limit = 6
): ScoredTitle[] {
  const catalogue = new Map(candidates.map((t) => [t.id, t]));
  for (const [id, t] of Object.entries(state.titleCache)) {
    if (!catalogue.has(id)) catalogue.set(id, t);
  }
  const seed = catalogue.get(seedId);
  if (!seed) return [];

  const now = new Date();
  const profile = buildProfile(state, catalogue, now);
  const request: SessionRequest = {
    ...EMPTY_REQUEST,
    languagePreference: state.preferences.languagePreference,
    providers: state.preferences.providers,
    similarToId: seedId,
  };

  const { kept } = filterCandidates(candidates, { state, request, now, relaxed: true });
  return rankCandidates(
    kept.filter((t) => t.id !== seedId),
    { request, profile, seedTitle: seed, now }
  ).slice(0, limit);
}

export type { BehaviouralProfile };
