import type { SessionRequest, SlotId, Title } from '@/lib/types';
import type { ScoredTitle } from './rank';
import { discoveryScore } from './rank';
import { shuffle } from './random';
import { titleSimilarity } from './vector';

/**
 * Slot assignment, and how many picks to show.
 *
 * Six slots exist, but the count is earned rather than fixed. The brief is
 * blunt about this and it's the right instinct: never pad the list to hit six.
 * A fifth suggestion that Papa can tell is filler damages trust in the four
 * good ones above it.
 *
 * So the count is derived from how many candidates are genuinely strong,
 * measured relative to the best available tonight rather than against an
 * absolute score — because "strong" on a thin Tuesday in a narrow genre filter
 * is not the same number as "strong" across the whole catalogue.
 */

const MIN_PICKS = 4;
const MAX_PICKS = 6;

/** Within this fraction of the top score counts as genuinely strong. */
const STRONG_RATIO = 0.74;

/**
 * When a mood is chosen, even the "different" and "wildcard" slots have to
 * stay inside it.
 *
 * Variety within a request is the goal — a mystery night should offer a
 * whodunnit, a heist, a psychological thriller and an old one. It should not
 * offer a village comedy just because that is maximally unlike the others.
 * This floor is what keeps "different" meaning "a different kind of what you
 * asked for" rather than "something else entirely".
 */
const MOOD_FLOOR = 8.5;

export interface SlotAssignment {
  slot: SlotId;
  scored: ScoredTitle;
  slotReason: string;
}

function maxSimilarityTo(candidate: Title, chosen: Title[]): number {
  if (chosen.length === 0) return 0;
  return Math.max(...chosen.map((c) => titleSimilarity(candidate, c)));
}

function hasEvidence(title: Title): boolean {
  return title.ratings.imdbRating != null || title.ratings.rtCriticScore != null;
}

function meetsBar(title: Title, minImdb: number): boolean {
  const { imdbRating, rtCriticScore } = title.ratings;
  if (imdbRating != null) return imdbRating >= minImdb;
  if (rtCriticScore != null) return rtCriticScore >= minImdb * 10;
  return false;
}

/** How many picks tonight's pool actually justifies. */
export function decideCount(ranked: ScoredTitle[]): { count: number; note: string } {
  if (ranked.length === 0) return { count: 0, note: 'No candidates survived filtering.' };

  const top = ranked[0].score;
  const strong = ranked.filter((r) => r.score >= top * STRONG_RATIO).length;

  const count = Math.max(
    Math.min(MIN_PICKS, ranked.length),
    Math.min(MAX_PICKS, strong, ranked.length)
  );

  const note =
    count < MAX_PICKS
      ? `${count} picks — only ${strong} candidates were both on brief and strong enough tonight. Padding the list with weaker ones would defeat the point.`
      : `${count} picks — plenty of strong candidates available.`;

  return { count, note };
}

export function assignSlots(
  ranked: ScoredTitle[],
  rng: () => number,
  options: { recyclable?: Set<string>; count?: number; request?: SessionRequest } = {}
): { assignments: SlotAssignment[]; note: string } {
  const moodSet = Boolean(options.request?.mood && options.request.mood !== 'surprise');
  /** Still recognisably what he asked for. */
  const onBrief = (r: ScoredTitle) => !moodSet || (r.breakdown.mood ?? 0) >= MOOD_FLOOR;

  /**
   * When a mood is set, the on-brief filter applies to EVERY slot, not just
   * the variety ones.
   *
   * Without this, a genuinely excellent title in the wrong genre wins on raw
   * score — a 8.9 gentle village comedy outranks a 8.2 thriller on a mystery
   * night, because quality and language together outweigh the mood term. That
   * is the correct ordering in the abstract and completely wrong in context:
   * he asked for a mystery.
   *
   * The full pool is kept as a fallback so a narrow request can never produce
   * an empty screen.
   */
  const eligible = moodSet ? ranked.filter(onBrief) : ranked;
  const pool = eligible.length >= MIN_PICKS ? eligible : ranked;

  const decided = options.count != null
    ? { count: options.count, note: `Fixed count of ${options.count}.` }
    : decideCount(pool);

  const assignments: SlotAssignment[] = [];
  const used = new Set<string>();
  const chosenTitles: Title[] = [];

  const remaining = () => pool.filter((r) => !used.has(r.title.id));

  const take = (scored: ScoredTitle | undefined, slot: SlotId, reason: string) => {
    if (!scored || assignments.length >= decided.count) return;
    used.add(scored.title.id);
    chosenTitles.push(scored.title);
    assignments.push({ slot, scored, slotReason: reason });
  };

  // ------------------------------------------------------------------ BEST
  // Highest scorer that we actually have evidence for. An unrated title can
  // sit in the list but never headline it.
  const best = remaining().find((r) => hasEvidence(r.title)) ?? remaining()[0];
  take(
    best,
    'best',
    'Top of the ranking once quality, reviews, language, mood and availability were combined.'
  );

  // ---------------------------------------------------------------- STRONG
  // A second confident recommendation — high score, meaningfully different.
  if (assignments.length < decided.count) {
    const strong = remaining()
      .map((r) => ({ r, value: r.score - maxSimilarityTo(r.title, chosenTitles) * 30 }))
      .sort((a, b) => b.value - a.value)[0]?.r;
    take(strong, 'strong', 'A second strong option that isn’t a near-copy of the first.');
  }

  // ------------------------------------------------------------------- GEM
  // Quality first, then hard weighting toward the least-saturated. The whole
  // point of this slot: he has already seen everything popular.
  if (assignments.length < decided.count) {
    const gem = remaining()
      .filter((r) => meetsBar(r.title, 7.3))
      .map((r) => ({
        r,
        value:
          r.score * 0.4 +
          discoveryScore(r.title, { discoveryMode: true } as never) * 3.2 -
          maxSimilarityTo(r.title, chosenTitles) * 20,
      }))
      .sort((a, b) => b.value - a.value)[0]?.r;

    if (gem) {
      const votes = gem.title.ratings.imdbVoteCount;
      take(
        gem,
        'gem',
        votes != null && votes < 120_000
          ? 'Rated highly but with a comparatively small audience — the kind of thing that slips past most people.'
          : 'Strongly rated and easy to have missed.'
      );
    }
  }

  // ------------------------------------------------------------- RECYCLED
  // At most one from the Later list, and only when it has rested. Mixed in
  // rather than jumped to the top.
  if (assignments.length < decided.count && options.recyclable?.size) {
    const recycled = remaining().find((r) => options.recyclable!.has(r.title.id));
    take(
      recycled,
      'recycled',
      'You set this aside a while back. It has rested long enough to come round again.'
    );
  }

  // ------------------------------------------------------------- DIFFERENT
  // The most unlike everything chosen so far — but still on brief.
  if (assignments.length < decided.count) {
    const different = remaining()
      .map((r) => ({ r, value: r.score * 0.45 - maxSimilarityTo(r.title, chosenTitles) * 55 }))
      .sort((a, b) => b.value - a.value)[0]?.r;

    if (different) {
      const genre = different.title.genres[0];
      take(
        different,
        'different',
        genre
          ? `A deliberate change of pace — ${genre.toLowerCase()} rather than more of the same.`
          : 'A deliberate change of pace from the picks above.'
      );
    }
  }

  // -------------------------------------------------------------- WILDCARD
  // The only slot with randomness, and even here the pool is pre-filtered on
  // quality and dissimilarity. Different is never an excuse for bad.
  let extras = 0;
  while (assignments.length < decided.count) {
    const wildPool = remaining().filter(
      (r) => meetsBar(r.title, 7.0) && maxSimilarityTo(r.title, chosenTitles) < 0.6
    );
    const fallback = remaining().slice(0, 6);
    const source = wildPool.length >= 3 ? wildPool.slice(0, 12) : fallback;
    const pick = shuffle(source, rng)[0];
    if (!pick) break;
    // Only the first extra is the Wildcard; repeating the label six times would
    // make it meaningless.
    take(
      pick,
      extras === 0 ? 'wildcard' : 'strong',
      extras === 0
        ? 'Pulled from tonight’s pool of titles that cleared the quality bar and don’t resemble the others.'
        : 'Also strong tonight, and different enough from the rest to be worth a look.'
    );
    extras += 1;
  }

  return { assignments, note: decided.note };
}
