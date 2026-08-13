import {
  RUNTIME_BANDS,
  eraForYear,
  type AppState,
  type SessionRequest,
  type Title,
} from '@/lib/types';
import { languageExcludes } from './language';

/**
 * Hard filters — the yes/no gates, applied before anything is scored.
 *
 * What belongs here: things that make a title genuinely unwatchable tonight.
 * Already seen. Ruled out. Not on a platform he pays for. Doesn't fit the
 * evening. Explicitly excluded by a filter he set himself.
 *
 * What does NOT belong here, and never will:
 *   · Genre — no tap on a card is ever evidence enough to bury a whole genre.
 *   · Language — a strong score adjustment instead. See language.ts.
 *   · The learned profile — a model that can *eliminate* candidates can trap
 *     him in a loop of its own making. It can only reorder.
 */

export const MAYBE_LATER_COOLDOWN_DAYS = 10;
export const SHOWN_COOLDOWN_DAYS = 21;

export interface FilterContext {
  state: AppState;
  request: SessionRequest;
  now: Date;
  excludeIds?: Set<string>;
  /** Relax the soft constraints when the pool comes up short. */
  relaxed?: boolean;
}

export interface FilterResult {
  kept: Title[];
  rejections: Record<string, number>;
  /** Titles out of Maybe Later cooldown, eligible to be recycled. */
  recyclable: Set<string>;
}

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 86_400_000;
}

export interface ExclusionSets {
  seen: Set<string>;
  rejected: Set<string>;
  maybeLater: Map<string, string>;
  watchToday: Set<string>;
}

export function buildExclusionSets(state: AppState): ExclusionSets {
  const seen = new Set<string>();
  const rejected = new Set<string>();
  const maybeLater = new Map<string, string>();
  const watchToday = new Set<string>();

  const sorted = [...state.actions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const action of sorted) {
    switch (action.action) {
      case 'SEEN_IT':
        seen.add(action.titleId);
        maybeLater.delete(action.titleId);
        rejected.delete(action.titleId);
        break;
      case 'NOT_INTERESTED':
        rejected.add(action.titleId);
        maybeLater.delete(action.titleId);
        break;
      case 'MAYBE_LATER':
        maybeLater.set(action.titleId, action.timestamp);
        rejected.delete(action.titleId);
        break;
      case 'WATCH_TODAY':
        // Choosing to watch it is, for our purposes, having seen it.
        watchToday.add(action.titleId);
        maybeLater.delete(action.titleId);
        break;
      // --- Post-watch outcomes ------------------------------------------
      // He watched it. Whatever he thought, it's out of the pool for good.
      case 'LOVED_IT':
      case 'WAS_FINE':
      case 'DIDNT_FINISH':
        seen.add(action.titleId);
        maybeLater.delete(action.titleId);
        watchToday.delete(action.titleId);
        break;

      // He never got to it — so it was never watched. Clear the pick and put
      // it back in the pool, otherwise a busy week silently deletes a title
      // he was actually interested in.
      case 'DIDNT_WATCH':
        watchToday.delete(action.titleId);
        seen.delete(action.titleId);
        break;

      case 'OPENED_DETAILS':
      case 'IGNORED':
        break;
    }
  }

  return { seen, rejected, maybeLater, watchToday };
}

/** Does this title satisfy the filters Papa set for tonight? */
function matchesRequest(title: Title, request: SessionRequest): string | null {
  if (request.genres.length) {
    const all = [...title.genres, ...title.subgenres].map((g) => g.toLowerCase());
    const wanted = request.genres.map((g) => g.toLowerCase());
    if (!wanted.some((g) => all.includes(g))) return 'Not the genre you asked for';
  }

  if (request.eras.length) {
    const era = title.era ?? eraForYear(title.releaseYear);
    if (!era || !request.eras.includes(era)) return 'Not from the era you asked for';
  }

  if (request.industries.length && !request.industries.includes(title.industry)) {
    return 'Not from the cinema you asked for';
  }

  if (request.formats.length) {
    // "Series" covers limited series unless he specifically asked for one.
    const matches = request.formats.some((f) =>
      f === 'series'
        ? title.type === 'series' || title.type === 'limited-series'
        : f === title.type
    );
    if (!matches) return 'Not the format you asked for';
  }

  if (languageExcludes(title, request.languagePreference)) {
    return 'You asked for Hindi originals only';
  }

  return null;
}

function fitsRuntime(title: Title, request: SessionRequest): boolean {
  if (request.runtime === 'any') return true;
  const band = RUNTIME_BANDS.find((b) => b.id === request.runtime);
  if (!band) return true;
  if (title.runtimeMinutes == null) return true; // unknown isn't disqualifying

  if (request.runtime === 'over120') return title.runtimeMinutes >= 115;
  // 15 minutes of grace — nobody abandons a film over ten extra minutes.
  return title.runtimeMinutes <= band.max + 15;
}

/**
 * The quality gate. Flexible by design rather than a fixed IMDb cutoff.
 *
 * A title is only rejected on quality when we actually have evidence. Unrated
 * is unproven, not bad — it just can't take a headline slot. And a niche title
 * that squarely matches an explicit request gets a little more latitude, which
 * is what the brief asks for.
 */
function passesQualityGate(title: Title, request: SessionRequest): boolean {
  const { imdbRating, imdbVoteCount, rtCriticScore, rtAudienceScore } = title.ratings;

  const specificRequest =
    request.genres.length > 0 || request.eras.length > 0 || request.industries.length > 0;
  const floor = specificRequest ? 6.2 : 6.6;

  // Strong critical reception can carry a soft audience score, and vice versa.
  const criticStrong = rtCriticScore != null && rtCriticScore >= 80;
  const audienceStrong = rtAudienceScore != null && rtAudienceScore >= 80;

  if (imdbRating != null) {
    if (imdbRating >= floor) return true;
    if (imdbRating >= floor - 0.5 && (criticStrong || audienceStrong)) return true;
    return false;
  }

  if (rtCriticScore != null) return rtCriticScore >= 60;
  if (title.ratings.tmdbScore != null) return title.ratings.tmdbScore >= 6.4;

  // No evidence at all. Allowed into the pool but it will rank poorly and can
  // never take the top slot — see slots.ts.
  return true;
}

export function filterCandidates(
  candidates: Title[],
  ctx: FilterContext
): FilterResult {
  const { state, request, now, excludeIds, relaxed } = ctx;
  const { seen, rejected, maybeLater, watchToday } = buildExclusionSets(state);

  const providers = new Set(
    request.providers.length ? request.providers : state.preferences.providers
  );

  const lastShown = new Map<string, string>();
  for (const entry of state.history) {
    if (!entry.displayed) continue;
    const existing = lastShown.get(entry.titleId);
    if (!existing || entry.date > existing) lastShown.set(entry.titleId, entry.date);
  }

  const recyclable = new Set<string>();
  for (const [id, at] of maybeLater) {
    if (daysSince(at, now) >= MAYBE_LATER_COOLDOWN_DAYS) recyclable.add(id);
  }

  const rejections: Record<string, number> = {};
  const bump = (reason: string) => {
    rejections[reason] = (rejections[reason] ?? 0) + 1;
  };

  const kept = candidates.filter((title) => {
    // --- Permanent, title-level exclusions. Never inferred, always explicit.
    if (seen.has(title.id)) return bump('Already seen'), false;
    if (rejected.has(title.id)) return bump('Marked not interested'), false;
    if (watchToday.has(title.id)) return bump('Already chosen to watch'), false;

    // --- Can he actually watch it?
    const available = title.availability.filter((a) => providers.has(a.provider));
    if (available.length === 0) return bump('Not on your platforms'), false;

    // --- What he asked for tonight.
    const mismatch = matchesRequest(title, request);
    if (mismatch) return bump(mismatch), false;

    if (!fitsRuntime(title, request)) return bump("Doesn't fit the time you have"), false;

    if (!passesQualityGate(title, request)) return bump('Below the quality bar'), false;

    // --- Soft constraints, dropped first when the pool runs thin.
    if (!relaxed) {
      const maybeAt = maybeLater.get(title.id);
      if (maybeAt && !recyclable.has(title.id)) {
        return bump('Resting in your Later list'), false;
      }

      const shownOn = lastShown.get(title.id);
      if (shownOn && daysSince(`${shownOn}T12:00:00`, now) < SHOWN_COOLDOWN_DAYS) {
        return bump('Shown too recently'), false;
      }
    }

    if (excludeIds?.has(title.id)) return bump('In the set being replaced'), false;

    return true;
  });

  return { kept, rejections, recyclable };
}

export function recyclableMaybeLater(state: AppState, now: Date): string[] {
  const { maybeLater } = buildExclusionSets(state);
  return [...maybeLater.entries()]
    .filter(([, at]) => daysSince(at, now) >= MAYBE_LATER_COOLDOWN_DAYS)
    .map(([id]) => id);
}
